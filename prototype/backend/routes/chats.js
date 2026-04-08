const express = require("express");
const pool = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");
const {
  logRouteFailure,
  logRouteHit,
  logRouteSuccess,
  sendError,
  sendSuccess,
} = require("../utils/apiResponse");

const router = express.Router();
const FREE_CHAT_MESSAGE_LIMIT = 2;
const FREE_CHAT_LIMIT_MESSAGE = "You’ve reached your free message limit";

function parseInteger(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMessageText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 4000) : null;
}

function getViewerRole(conversation, viewerId) {
  if (Number(conversation.user_id) === Number(viewerId)) {
    return "user";
  }

  if (Number(conversation.owner_id) === Number(viewerId)) {
    return "owner";
  }

  return null;
}

function computeHasUnread(conversation, viewerRole) {
  if (typeof conversation?.unread_count === "number") {
    return conversation.unread_count > 0;
  }

  if (!conversation?.last_message_at || !conversation?.last_message_sender_id) {
    return false;
  }

  const viewerId =
    viewerRole === "owner" ? Number(conversation.owner_id) : Number(conversation.user_id);
  const lastSenderId = Number(conversation.last_message_sender_id);

  if (!Number.isFinite(viewerId) || !Number.isFinite(lastSenderId) || lastSenderId === viewerId) {
    return false;
  }

  const readAtValue =
    viewerRole === "owner" ? conversation.owner_last_read_at : conversation.user_last_read_at;
  const lastMessageAt = new Date(conversation.last_message_at).getTime();
  const readAt = readAtValue ? new Date(readAtValue).getTime() : null;

  if (!Number.isFinite(lastMessageAt)) {
    return false;
  }

  return readAt === null || lastMessageAt > readAt;
}

function countUnreadMessagesForViewer(messages, viewerId, readAtValue) {
  const readAt = readAtValue ? new Date(readAtValue).getTime() : null;

  return messages.reduce((count, message) => {
    if (Number(message.receiver_id) !== Number(viewerId)) {
      return count;
    }

    const createdAt = new Date(message.created_at).getTime();

    if (!Number.isFinite(createdAt)) {
      return count;
    }

    if (readAt !== null && createdAt <= readAt) {
      return count;
    }

    return count + 1;
  }, 0);
}

function buildConversationSummary(conversation, viewerRole) {
  return {
    id: Number(conversation.id),
    user_id: Number(conversation.user_id),
    user_name: conversation.user_name,
    store_id: Number(conversation.store_id),
    store_name: conversation.store_name,
    owner_id: Number(conversation.owner_id),
    created_at: conversation.created_at,
    updated_at: conversation.updated_at,
    last_message: conversation.last_message ?? null,
    last_message_at: conversation.last_message_at ?? null,
    last_message_sender_id:
      conversation.last_message_sender_id === null ||
      conversation.last_message_sender_id === undefined
        ? null
        : Number(conversation.last_message_sender_id),
    has_unread: computeHasUnread(conversation, viewerRole),
    unread_count:
      conversation.unread_count === null || conversation.unread_count === undefined
        ? computeHasUnread(conversation, viewerRole)
          ? 1
          : 0
        : Number(conversation.unread_count),
    viewer_role: viewerRole,
  };
}

function buildMessage(message) {
  return {
    id: Number(message.id),
    conversation_id: Number(message.conversation_id),
    sender_id: Number(message.sender_id),
    receiver_id: Number(message.receiver_id),
    text: message.text,
    created_at: message.created_at,
  };
}

async function getUserById(client, userId) {
  const { rows } = await client.query(
    `
      SELECT id, name, premium_status
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] || null;
}

async function getFreeChatMessagesSentCount(client, userId) {
  const { rows } = await client.query(
    `
      SELECT COUNT(*)::INT AS messages_sent_count
      FROM messages sent_messages
      JOIN conversations sent_conversations
        ON sent_conversations.id = sent_messages.conversation_id
      WHERE sent_messages.sender_id = $1
        AND sent_conversations.user_id = $1
    `,
    [userId],
  );

  return Number(rows[0]?.messages_sent_count ?? 0);
}

function buildChatUserState(user) {
  return {
    id: Number(user.id),
    premium: Boolean(user.premium_status),
    premium_status: Boolean(user.premium_status),
    messages_sent_count: Number(user.messages_sent_count ?? 0),
  };
}

function hasUnlimitedChat(user) {
  return Boolean(user?.premium_status);
}

function hasReachedFreeChatLimit(user) {
  return (
    !hasUnlimitedChat(user) &&
    Number(user?.messages_sent_count ?? 0) >= FREE_CHAT_MESSAGE_LIMIT
  );
}

async function incrementMessagesSentCountIfNeeded(client, user) {
  if (hasUnlimitedChat(user)) {
    return user;
  }

  return {
    ...user,
    messages_sent_count: Number(user?.messages_sent_count ?? 0) + 1,
  };
}

async function hasOwnedStore(client, userId) {
  const { rows } = await client.query(
    `
      SELECT 1
      FROM stores
      WHERE owner_id = $1
      LIMIT 1
    `,
    [userId],
  );

  return rows.length > 0;
}

async function ensureViewerCanUseChat(client, viewerId, role) {
  const viewer = await getUserById(client, viewerId);

  if (!viewer) {
    return {
      allowed: false,
      status: 404,
      message: "User not found",
    };
  }

  if (role === "owner") {
    const ownsStore = await hasOwnedStore(client, viewerId);

    if (!ownsStore) {
      return {
        allowed: false,
        status: 403,
        message: "Store inbox is for store owners",
      };
    }
  }

  if (role === "owner" && !viewer.premium_status) {
    return {
      allowed: false,
      status: 403,
      message:
        role === "owner"
          ? "Upgrade to Pro to receive and respond to customer messages."
          : "Upgrade to Pro to start chatting with stores.",
    };
  }

  return {
    allowed: true,
    viewer,
  };
}

async function getStoreById(client, storeId) {
  const { rows } = await client.query(
    `
      SELECT id, store_name, owner_id
      FROM stores
      WHERE id = $1
      LIMIT 1
    `,
    [storeId],
  );

  return rows[0] || null;
}

async function getConversationRow(client, conversationId) {
  const { rows } = await client.query(
    `
      SELECT
        c.id,
        c.user_id,
        c.store_id,
        c.user_last_read_at,
        c.owner_last_read_at,
        c.created_at,
        c.updated_at,
        s.store_name,
        s.owner_id,
        u.name AS user_name,
        lm.text AS last_message,
        lm.created_at AS last_message_at,
        lm.sender_id AS last_message_sender_id
      FROM conversations c
      JOIN stores s ON s.id = c.store_id
      JOIN users u ON u.id = c.user_id
      LEFT JOIN LATERAL (
        SELECT m.text, m.created_at, m.sender_id
        FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      ) lm ON TRUE
      WHERE c.id = $1
      LIMIT 1
    `,
    [conversationId],
  );

  return rows[0] || null;
}

function buildChatSendPayloadLog({
  conversationId,
  receiverId,
  senderId,
  storeId = null,
  text,
}) {
  return {
    conversationId,
    receiverId,
    senderId,
    storeId,
    textLength: typeof text === "string" ? text.length : 0,
  };
}

async function getConversationDetailForViewer(client, conversationId, viewerId) {
  const conversation = await getConversationRow(client, conversationId);

  if (!conversation) {
    return {
      status: "not_found",
      conversation: null,
    };
  }

  const viewerRole = getViewerRole(conversation, viewerId);

  if (!viewerRole) {
    return {
      status: "forbidden",
      conversation: null,
    };
  }

  const messagesResult = await client.query(
    `
      SELECT id, conversation_id, sender_id, receiver_id, text, created_at
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC, id ASC
    `,
    [conversationId],
  );

  const unreadCount = countUnreadMessagesForViewer(
    messagesResult.rows,
    viewerId,
    viewerRole === "owner" ? conversation.owner_last_read_at : conversation.user_last_read_at,
  );

  return {
    status: "ok",
    conversation: {
      ...buildConversationSummary({
        ...conversation,
        unread_count: unreadCount,
      }, viewerRole),
      messages: messagesResult.rows.map(buildMessage),
    },
  };
}

router.get("/", authMiddleware, async (req, res) => {
  const viewerId = Number(req.user.id);
  const role = req.query.role === "owner" ? "owner" : "user";
  logRouteHit(req, "chats/list", {
    role,
    viewerId,
  });

  try {
    const client = await pool.connect();

    try {
      const access = await ensureViewerCanUseChat(client, viewerId, role);

      if (!access.allowed) {
        return res.status(access.status).json({
          message: access.message,
        });
      }

      const { rows } = await client.query(
        `
        SELECT
          c.id,
          c.user_id,
          c.store_id,
          c.user_last_read_at,
          c.owner_last_read_at,
          c.created_at,
          c.updated_at,
          s.store_name,
          s.owner_id,
          u.name AS user_name,
          lm.text AS last_message,
          lm.created_at AS last_message_at,
          lm.sender_id AS last_message_sender_id,
          (
            SELECT COUNT(*)::INT
            FROM messages unread
            WHERE unread.conversation_id = c.id
              AND unread.receiver_id = $1
              AND (
                (
                  $2 = 'owner'
                  AND (c.owner_last_read_at IS NULL OR unread.created_at > c.owner_last_read_at)
                )
                OR (
                  $2 = 'user'
                  AND (c.user_last_read_at IS NULL OR unread.created_at > c.user_last_read_at)
                )
              )
          ) AS unread_count
        FROM conversations c
        JOIN stores s ON s.id = c.store_id
        JOIN users u ON u.id = c.user_id
        LEFT JOIN LATERAL (
          SELECT m.text, m.created_at, m.sender_id
          FROM messages m
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC, m.id DESC
          LIMIT 1
        ) lm ON TRUE
        WHERE ${role === "owner" ? "s.owner_id = $1" : "c.user_id = $1"}
        ORDER BY COALESCE(lm.created_at, c.updated_at, c.created_at) DESC, c.id DESC
      `,
        [viewerId, role],
      );

      logRouteSuccess(req, "chats/list", 200, {
        conversationCount: rows.length,
        role,
        viewerId,
      });
      return sendSuccess(res, 200, {
        conversations: rows.map((row) => buildConversationSummary(row, role)),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    logRouteFailure(req, "chats/list", 500, error, {
      role,
      viewerId,
    });
    return sendError(res, 500, "Could not load chats", {
      message: "Could not load chats",
    });
  }
});

router.get("/store/:storeId", authMiddleware, async (req, res) => {
  const viewerId = Number(req.user.id);
  const storeId = parseInteger(req.params.storeId);
  logRouteHit(req, "chats/store-preview", {
    storeId,
    viewerId,
  });

  if (!storeId) {
    return sendError(res, 400, "Invalid store id", {
      message: "Invalid store id",
    });
  }

  const client = await pool.connect();

  try {
    const store = await getStoreById(client, storeId);

    if (!store) {
      return sendError(res, 404, "Store not found", {
        message: "Store not found",
      });
    }

    const conversationLookup = await client.query(
      `
        SELECT id
        FROM conversations
        WHERE user_id = $1 AND store_id = $2
        LIMIT 1
      `,
      [viewerId, storeId],
    );

    let conversation = null;

    if (conversationLookup.rows[0]?.id) {
      const detail = await getConversationDetailForViewer(
        client,
        conversationLookup.rows[0].id,
        viewerId,
      );
      conversation = detail.conversation;
    }

    logRouteSuccess(req, "chats/store-preview", 200, {
      conversationId: conversation?.id ?? null,
      storeId,
      viewerId,
    });
    return sendSuccess(res, 200, {
      store: {
        id: Number(store.id),
        store_name: store.store_name,
      },
      conversation,
    });
  } catch (error) {
    logRouteFailure(req, "chats/store-preview", 500, error, {
      storeId,
      viewerId,
    });
    return sendError(res, 500, "Could not load this chat", {
      message: "Could not load this chat",
    });
  } finally {
    client.release();
  }
});

router.get("/:conversationId", authMiddleware, async (req, res) => {
  const viewerId = Number(req.user.id);
  const conversationId = parseInteger(req.params.conversationId);
  logRouteHit(req, "chats/detail", {
    conversationId,
    viewerId,
  });

  if (!conversationId) {
    return sendError(res, 400, "Invalid conversation id", {
      message: "Invalid conversation id",
    });
  }

  const client = await pool.connect();

  try {
    const detail = await getConversationDetailForViewer(client, conversationId, viewerId);

    if (detail.status === "not_found") {
      return sendError(res, 404, "Conversation not found", {
        message: "Conversation not found",
      });
    }

    if (detail.status === "forbidden") {
      return sendError(res, 403, "You are not allowed to view this conversation", {
        message: "You are not allowed to view this conversation",
      });
    }

    const access = await ensureViewerCanUseChat(client, viewerId, detail.conversation.viewer_role);

      if (!access.allowed) {
        return sendError(res, access.status, access.message, {
          message: access.message,
        });
      }

    logRouteSuccess(req, "chats/detail", 200, {
      conversationId,
      messageCount: detail.conversation.messages.length,
      viewerId,
      viewerRole: detail.conversation.viewer_role,
    });
    return sendSuccess(res, 200, {
      conversation: detail.conversation,
    });
  } catch (error) {
    logRouteFailure(req, "chats/detail", 500, error, {
      conversationId,
      viewerId,
    });
    return sendError(res, 500, "Could not load that conversation", {
      message: "Could not load that conversation",
    });
  } finally {
    client.release();
  }
});

router.post("/store/:storeId/messages", authMiddleware, async (req, res) => {
  const viewerId = Number(req.user.id);
  const storeId = parseInteger(req.params.storeId);
  const text = normalizeMessageText(req.body?.text);
  logRouteHit(req, "chats/send-to-store", {
    storeId,
    textLength: text?.length ?? 0,
    viewerId,
  });

  if (!storeId) {
    return sendError(res, 400, "Invalid store id", {
      message: "Invalid store id",
    });
  }

  if (!text) {
    return sendError(res, 400, "Message text is required", {
      message: "Message text is required",
    });
  }

  const client = await pool.connect();
  let transactionOpen = false;

  try {
    const sender = await getUserById(client, viewerId);

    if (!sender) {
      return sendError(res, 404, "User not found", {
        message: "User not found",
      });
    }

    sender.messages_sent_count = await getFreeChatMessagesSentCount(client, viewerId);

    if (hasReachedFreeChatLimit(sender)) {
      return sendError(res, 402, FREE_CHAT_LIMIT_MESSAGE, {
        limit: FREE_CHAT_MESSAGE_LIMIT,
        message: FREE_CHAT_LIMIT_MESSAGE,
        user: buildChatUserState(sender),
      });
    }

    const store = await getStoreById(client, storeId);

    if (!store) {
      return sendError(res, 404, "Store not found", {
        message: "Store not found",
      });
    }

    if (!store.owner_id) {
      return sendError(res, 400, "This store cannot receive messages yet", {
        message: "This store cannot receive messages yet",
      });
    }

    if (Number(store.owner_id) === viewerId) {
      return sendError(res, 400, "Use the store owner inbox to reply to customers", {
        message: "Use the store owner inbox to reply to customers",
      });
    }

    const receiverId = Number(store.owner_id);

    if (!Number.isInteger(viewerId) || !Number.isInteger(receiverId)) {
      return sendError(res, 400, "This store cannot receive messages yet", {
        message: "This store cannot receive messages yet",
      });
    }

    if (viewerId === receiverId) {
      return sendError(res, 400, "You cannot message yourself", {
        message: "You cannot message yourself",
      });
    }

    console.log("[chats/send-to-store] validated payload", buildChatSendPayloadLog({
      receiverId,
      senderId: viewerId,
      storeId,
      text,
    }));

    await client.query("BEGIN");
    transactionOpen = true;

    const conversationResult = await client.query(
      `
        INSERT INTO conversations (user_id, store_id, user_last_read_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id, store_id)
        DO UPDATE SET updated_at = conversations.updated_at
        RETURNING id
      `,
      [viewerId, storeId],
    );

    const conversationId = Number(conversationResult.rows[0].id);
    const updatedSender = await incrementMessagesSentCountIfNeeded(client, sender);
    const messageResult = await client.query(
      `
        INSERT INTO messages (conversation_id, sender_id, receiver_id, text)
        VALUES ($1, $2, $3, $4)
        RETURNING id, conversation_id, sender_id, receiver_id, text, created_at
      `,
      [conversationId, viewerId, receiverId, text],
    );

    const message = messageResult.rows[0];

    await client.query(
      `
        UPDATE conversations
        SET updated_at = $2,
            user_last_read_at = $2
        WHERE id = $1
      `,
      [conversationId, message.created_at],
    );

    await client.query("COMMIT");
    transactionOpen = false;

    const detail = await getConversationDetailForViewer(client, conversationId, viewerId);

    console.log("[chats/send-to-store] saved message", {
      conversationId,
      messageId: Number(message.id),
      receiverId,
      senderId: viewerId,
      storeId,
    });
    logRouteSuccess(req, "chats/send-to-store", 201, {
      conversationId,
      messageId: Number(message.id),
      receiverId,
      senderId: viewerId,
      storeId,
    });
    return sendSuccess(res, 201, {
      message: "Message sent",
      conversation: detail.conversation,
      sent_message: buildMessage(message),
      user: buildChatUserState(updatedSender),
    });
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("chat send rollback failed", rollbackError);
      }
    }

    logRouteFailure(req, "chats/send-to-store", 500, error, {
      storeId,
      viewerId,
    });
    return sendError(res, 500, "Could not send this message", {
      message: "Could not send this message",
    });
  } finally {
    client.release();
  }
});

router.post("/:conversationId/messages", authMiddleware, async (req, res) => {
  const viewerId = Number(req.user.id);
  const conversationId = parseInteger(req.params.conversationId);
  const text = normalizeMessageText(req.body?.text);
  logRouteHit(req, "chats/reply", {
    conversationId,
    textLength: text?.length ?? 0,
    viewerId,
  });

  if (!conversationId) {
    return sendError(res, 400, "Invalid conversation id", {
      message: "Invalid conversation id",
    });
  }

  if (!text) {
    return sendError(res, 400, "Message text is required", {
      message: "Message text is required",
    });
  }

  const client = await pool.connect();
  let transactionOpen = false;

  try {
    const conversation = await getConversationRow(client, conversationId);
    let updatedSender = null;

    if (!conversation) {
      return sendError(res, 404, "Conversation not found", {
        message: "Conversation not found",
      });
    }

    const viewerRole = getViewerRole(conversation, viewerId);

    if (!viewerRole) {
      return sendError(res, 403, "You are not allowed to reply to this conversation", {
        message: "You are not allowed to reply to this conversation",
      });
    }

    if (viewerRole === "user") {
      const access = await ensureViewerCanUseChat(client, viewerId, "user");

      if (!access.allowed) {
        return sendError(res, access.status, access.message, {
          message: access.message,
        });
      }

      access.viewer.messages_sent_count = await getFreeChatMessagesSentCount(client, viewerId);

      if (hasReachedFreeChatLimit(access.viewer)) {
        return sendError(res, 402, FREE_CHAT_LIMIT_MESSAGE, {
          limit: FREE_CHAT_MESSAGE_LIMIT,
          message: FREE_CHAT_LIMIT_MESSAGE,
          user: buildChatUserState(access.viewer),
        });
      }

      updatedSender = access.viewer;
    }

    if (viewerRole === "owner") {
      const access = await ensureViewerCanUseChat(client, viewerId, "owner");

      if (!access.allowed) {
        return sendError(res, access.status, access.message, {
          message: access.message,
        });
      }
    }

    const receiverId =
      viewerRole === "owner"
        ? Number(conversation.user_id)
        : Number(conversation.owner_id);

    if (!Number.isFinite(receiverId)) {
      return sendError(res, 400, "This conversation cannot receive replies yet", {
        message: "This conversation cannot receive replies yet",
      });
    }

    if (viewerId === receiverId) {
      return sendError(res, 400, "You cannot message yourself", {
        message: "You cannot message yourself",
      });
    }

    console.log("[chats/reply] validated payload", buildChatSendPayloadLog({
      conversationId,
      receiverId,
      senderId: viewerId,
      text,
    }));

    await client.query("BEGIN");
    transactionOpen = true;

    if (viewerRole === "user" && updatedSender) {
      updatedSender = await incrementMessagesSentCountIfNeeded(client, updatedSender);
    } else {
      updatedSender = await getUserById(client, viewerId);
    }

    const messageResult = await client.query(
      `
        INSERT INTO messages (conversation_id, sender_id, receiver_id, text)
        VALUES ($1, $2, $3, $4)
        RETURNING id, conversation_id, sender_id, receiver_id, text, created_at
      `,
      [conversationId, viewerId, receiverId, text],
    );

    const message = messageResult.rows[0];
    const readColumn = viewerRole === "owner" ? "owner_last_read_at" : "user_last_read_at";

    await client.query(
      `
        UPDATE conversations
        SET updated_at = $2,
            ${readColumn} = $2
        WHERE id = $1
      `,
      [conversationId, message.created_at],
    );

    await client.query("COMMIT");
    transactionOpen = false;

    const detail = await getConversationDetailForViewer(client, conversationId, viewerId);

    console.log("[chats/reply] saved message", {
      conversationId,
      messageId: Number(message.id),
      receiverId,
      senderId: viewerId,
      viewerRole,
    });
    logRouteSuccess(req, "chats/reply", 201, {
      conversationId,
      messageId: Number(message.id),
      receiverId,
      senderId: viewerId,
      viewerRole,
    });
    return sendSuccess(res, 201, {
      message: "Reply sent",
      conversation: detail.conversation,
      sent_message: buildMessage(message),
      user: updatedSender ? buildChatUserState(updatedSender) : null,
    });
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("chat reply rollback failed", rollbackError);
      }
    }

    logRouteFailure(req, "chats/reply", 500, error, {
      conversationId,
      viewerId,
    });
    return sendError(res, 500, "Could not send this reply", {
      message: "Could not send this reply",
    });
  } finally {
    client.release();
  }
});

router.post("/:conversationId/read", authMiddleware, async (req, res) => {
  const viewerId = Number(req.user.id);
  const conversationId = parseInteger(req.params.conversationId);
  logRouteHit(req, "chats/read", {
    conversationId,
    viewerId,
  });

  if (!conversationId) {
    return sendError(res, 400, "Invalid conversation id", {
      message: "Invalid conversation id",
    });
  }

  const client = await pool.connect();

  try {
    const conversation = await getConversationRow(client, conversationId);

    if (!conversation) {
      return sendError(res, 404, "Conversation not found", {
        message: "Conversation not found",
      });
    }

    const viewerRole = getViewerRole(conversation, viewerId);

    if (!viewerRole) {
      return sendError(res, 403, "You are not allowed to update this conversation", {
        message: "You are not allowed to update this conversation",
      });
    }

    const access = await ensureViewerCanUseChat(client, viewerId, viewerRole);

    if (!access.allowed) {
      return sendError(res, access.status, access.message, {
        message: access.message,
      });
    }

    const latestMessageResult = await client.query(
      `
        SELECT created_at
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [conversationId],
    );

    const readAt = latestMessageResult.rows[0]?.created_at || new Date().toISOString();
    const readColumn = viewerRole === "owner" ? "owner_last_read_at" : "user_last_read_at";

    await client.query(
      `
        UPDATE conversations
        SET ${readColumn} = $2
        WHERE id = $1
      `,
      [conversationId, readAt],
    );

    const detail = await getConversationDetailForViewer(client, conversationId, viewerId);

    logRouteSuccess(req, "chats/read", 200, {
      conversationId,
      viewerId,
      viewerRole,
    });
    return sendSuccess(res, 200, {
      message: "Conversation marked as read",
      conversation: detail.conversation,
    });
  } catch (error) {
    logRouteFailure(req, "chats/read", 500, error, {
      conversationId,
      viewerId,
    });
    return sendError(res, 500, "Could not update this conversation", {
      message: "Could not update this conversation",
    });
  } finally {
    client.release();
  }
});

module.exports = router;
