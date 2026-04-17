import { requestMobileApi } from "@/services/api";

const CHAT_CACHE_TTL_MS = 12_000;

export type ChatMessage = {
  conversation_id: number;
  created_at: string;
  id: number;
  receiver_id: number;
  sender_id: number;
  text: string;
};

export type ChatConversationSummary = {
  created_at: string;
  has_unread: boolean;
  id: number;
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender_id: number | null;
  owner_id: number;
  store_id: number;
  store_name: string;
  unread_count: number;
  updated_at: string;
  user_id: number;
  user_name: string;
  viewer_role: "owner" | "user";
};

export type ChatConversationDetail = ChatConversationSummary & {
  messages: ChatMessage[];
};

type ChatPreviewResponse = {
  conversation?: ChatConversationDetail | null;
  store?: {
    id: number;
    store_name: string;
  };
};

type ApiEnvelope<T> = {
  data?: T;
  error?: string;
  message?: string;
  success?: boolean;
};

type ChatListResponse = {
  conversations?: ChatConversationSummary[];
};

type ChatDetailResponse = {
  conversation?: ChatConversationDetail;
};

type ChatSendResponse = {
  conversation?: ChatConversationDetail;
  message?: string;
  sent_message?: ChatMessage;
  user?: {
    id: number;
    messages_sent_count?: number;
    premium?: boolean;
    premium_status?: boolean;
  } | null;
};

const conversationListCache = new Map<
  string,
  {
    expiresAt: number;
    value:
      | {
          conversations: ChatConversationSummary[];
          ok: true;
          status: number;
          url: string;
        }
      | {
          conversations: ChatConversationSummary[];
          error: string;
          ok: false;
          status: number;
          url: string;
        };
  }
>();
const inflightConversationListRequests = new Map<
  string,
  Promise<
    | {
        conversations: ChatConversationSummary[];
        ok: true;
        status: number;
        url: string;
      }
    | {
        conversations: ChatConversationSummary[];
        error: string;
        ok: false;
        status: number;
        url: string;
      }
  >
>();
const conversationPreviewCache = new Map<
  string,
  {
    expiresAt: number;
    value:
      | {
          conversation: ChatConversationDetail | null;
          ok: true;
          status: number;
          store: { id: number; store_name: string } | null;
          url: string;
        }
      | {
          conversation: null;
          error: string;
          ok: false;
          status: number;
          store: null;
          url: string;
        };
  }
>();
const inflightConversationPreviewRequests = new Map<
  string,
  Promise<
    | {
        conversation: ChatConversationDetail | null;
        ok: true;
        status: number;
        store: { id: number; store_name: string } | null;
        url: string;
      }
    | {
        conversation: null;
        error: string;
        ok: false;
        status: number;
        store: null;
        url: string;
      }
  >
>();
const conversationDetailCache = new Map<
  string,
  {
    expiresAt: number;
    value:
      | {
          conversation: ChatConversationDetail;
          ok: true;
          status: number;
          url: string;
        }
      | {
          conversation: null;
          error: string;
          ok: false;
          status: number;
          url: string;
        };
  }
>();
const inflightConversationDetailRequests = new Map<
  string,
  Promise<
    | {
        conversation: ChatConversationDetail;
        ok: true;
        status: number;
        url: string;
      }
    | {
        conversation: null;
        error: string;
        ok: false;
        status: number;
        url: string;
      }
  >
>();

function unwrapEnvelope<T>(payload: ApiEnvelope<T> | T | null | undefined) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("data" in payload) {
    return (payload.data ?? null) as T | null;
  }

  return payload as T;
}

function buildChatCacheKey(token: string, suffix: string) {
  return `${token}:${suffix}`;
}

function buildInvalidPayloadError(context: string) {
  return `We couldn't load ${context} right now.`;
}

function cleanupChatCaches() {
  const now = Date.now();

  for (const cache of [
    conversationListCache,
    conversationPreviewCache,
    conversationDetailCache,
  ]) {
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt <= now) {
        cache.delete(key);
      }
    }
  }
}

export function invalidateChatCache(options?: {
  conversationId?: string | null;
  role?: "owner" | "user" | null;
  storeId?: string | null;
  token?: string | null;
}) {
  const token = options?.token || null;

  if (!token) {
    conversationListCache.clear();
    conversationPreviewCache.clear();
    conversationDetailCache.clear();
    inflightConversationListRequests.clear();
    inflightConversationPreviewRequests.clear();
    inflightConversationDetailRequests.clear();
    return;
  }

  if (options?.role) {
    const listKey = buildChatCacheKey(token, `list:${options.role}`);
    conversationListCache.delete(listKey);
    inflightConversationListRequests.delete(listKey);
  } else {
    for (const key of conversationListCache.keys()) {
      if (key.startsWith(`${token}:list:`)) {
        conversationListCache.delete(key);
        inflightConversationListRequests.delete(key);
      }
    }
  }

  if (options?.storeId) {
    const previewKey = buildChatCacheKey(token, `preview:${options.storeId}`);
    conversationPreviewCache.delete(previewKey);
    inflightConversationPreviewRequests.delete(previewKey);
  }

  if (options?.conversationId) {
    const detailKey = buildChatCacheKey(
      token,
      `detail:${options.conversationId}`,
    );
    conversationDetailCache.delete(detailKey);
    inflightConversationDetailRequests.delete(detailKey);
  }
}

async function requireChatRequest<T>(
  path: string,
  options: {
    body?: Record<string, string | number | boolean | null>;
    method?: "GET" | "POST";
    token: string;
  },
) {
  return requestMobileApi<T>(path, {
    body: options.body,
    method: options.method,
    token: options.token,
  });
}

export async function fetchChatConversations(
  token: string,
  role: "owner" | "user",
) {
  cleanupChatCaches();
  const cacheKey = buildChatCacheKey(token, `list:${role}`);
  const cached = conversationListCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inflight = inflightConversationListRequests.get(cacheKey);

  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    const result = await requireChatRequest<ApiEnvelope<ChatListResponse>>(
      `/chats?role=${role}`,
      {
        method: "GET",
        token,
      },
    );
    const payload = result.ok
      ? unwrapEnvelope<ChatListResponse>(result.data)
      : null;

    if (!result.ok) {
      return {
        conversations: [] as ChatConversationSummary[],
        error: result.error,
        ok: false as const,
        status: result.status,
        url: result.url,
      };
    }

    if (!Array.isArray(payload?.conversations)) {
      return {
        conversations: [] as ChatConversationSummary[],
        error: buildInvalidPayloadError("chats"),
        ok: false as const,
        status: result.status,
        url: result.url,
      };
    }

    const value = {
      conversations: payload.conversations,
      ok: true as const,
      status: result.status,
      url: result.url,
    };

    conversationListCache.set(cacheKey, {
      expiresAt: Date.now() + CHAT_CACHE_TTL_MS,
      value,
    });

    return value;
  })();

  inflightConversationListRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    if (inflightConversationListRequests.get(cacheKey) === request) {
      inflightConversationListRequests.delete(cacheKey);
    }
  }
}

export async function fetchStoreChatPreview(token: string, storeId: string) {
  cleanupChatCaches();
  const cacheKey = buildChatCacheKey(token, `preview:${storeId}`);
  const cached = conversationPreviewCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inflight = inflightConversationPreviewRequests.get(cacheKey);

  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    const result = await requireChatRequest<ApiEnvelope<ChatPreviewResponse>>(
      `/chats/store/${storeId}`,
      {
        method: "GET",
        token,
      },
    );
    const payload = result.ok
      ? unwrapEnvelope<ChatPreviewResponse>(result.data)
      : null;

    if (!result.ok) {
      return {
        conversation: null,
        error: result.error,
        ok: false as const,
        status: result.status,
        store: null,
        url: result.url,
      };
    }

    const value = {
      conversation: payload?.conversation ?? null,
      ok: true as const,
      status: result.status,
      store: payload?.store ?? null,
      url: result.url,
    };

    conversationPreviewCache.set(cacheKey, {
      expiresAt: Date.now() + CHAT_CACHE_TTL_MS,
      value,
    });

    return value;
  })();

  inflightConversationPreviewRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    if (inflightConversationPreviewRequests.get(cacheKey) === request) {
      inflightConversationPreviewRequests.delete(cacheKey);
    }
  }
}

export async function fetchChatConversation(
  token: string,
  conversationId: string,
) {
  cleanupChatCaches();
  const cacheKey = buildChatCacheKey(token, `detail:${conversationId}`);
  const cached = conversationDetailCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inflight = inflightConversationDetailRequests.get(cacheKey);

  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    const result = await requireChatRequest<ApiEnvelope<ChatDetailResponse>>(
      `/chats/${conversationId}`,
      {
        method: "GET",
        token,
      },
    );
    const payload = result.ok
      ? unwrapEnvelope<ChatDetailResponse>(result.data)
      : null;

    if (!result.ok || !payload?.conversation) {
      return {
        conversation: null,
        error: result.ok
          ? "We couldn't open this conversation right now."
          : result.error,
        ok: false as const,
        status: result.status,
        url: result.url,
      };
    }

    const value = {
      conversation: payload.conversation,
      ok: true as const,
      status: result.status,
      url: result.url,
    };

    conversationDetailCache.set(cacheKey, {
      expiresAt: Date.now() + CHAT_CACHE_TTL_MS,
      value,
    });

    return value;
  })();

  inflightConversationDetailRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    if (inflightConversationDetailRequests.get(cacheKey) === request) {
      inflightConversationDetailRequests.delete(cacheKey);
    }
  }
}

export async function sendStoreChatMessage(
  token: string,
  storeId: string,
  text: string,
) {
  const result = await requireChatRequest<ApiEnvelope<ChatSendResponse>>(
    `/chats/store/${storeId}/messages`,
    {
      body: { text },
      method: "POST",
      token,
    },
  );
  const payload = result.ok
    ? unwrapEnvelope<ChatSendResponse>(result.data)
    : null;

  if (!result.ok || !payload?.conversation) {
    return {
      conversation: null,
      error: result.ok
        ? "We couldn't send your message right now."
        : result.error,
      ok: false as const,
      status: result.status,
      url: result.url,
      user: result.ok ? (payload?.user ?? null) : null,
    };
  }

  invalidateChatCache({
    storeId,
    token,
  });

  return {
    conversation: payload.conversation,
    ok: true as const,
    status: result.status,
    url: result.url,
    user: payload.user ?? null,
  };
}

export async function sendConversationChatMessage(
  token: string,
  conversationId: string,
  text: string,
) {
  const result = await requireChatRequest<ApiEnvelope<ChatSendResponse>>(
    `/chats/${conversationId}/messages`,
    {
      body: { text },
      method: "POST",
      token,
    },
  );
  const payload = result.ok
    ? unwrapEnvelope<ChatSendResponse>(result.data)
    : null;

  if (!result.ok || !payload?.conversation) {
    return {
      conversation: null,
      error: result.ok
        ? "We couldn't send your reply right now."
        : result.error,
      ok: false as const,
      status: result.status,
      url: result.url,
      user: result.ok ? (payload?.user ?? null) : null,
    };
  }

  invalidateChatCache({
    conversationId,
    token,
  });

  return {
    conversation: payload.conversation,
    ok: true as const,
    status: result.status,
    url: result.url,
    user: payload.user ?? null,
  };
}

export async function markConversationRead(
  token: string,
  conversationId: string,
) {
  const result = await requireChatRequest<ApiEnvelope<ChatDetailResponse>>(
    `/chats/${conversationId}/read`,
    {
      method: "POST",
      token,
    },
  );
  const payload = result.ok
    ? unwrapEnvelope<ChatDetailResponse>(result.data)
    : null;

  if (!result.ok || !payload?.conversation) {
    return {
      conversation: null,
      error: result.ok
        ? "We couldn't refresh this conversation right now."
        : result.error,
      ok: false as const,
      status: result.status,
      url: result.url,
    };
  }

  invalidateChatCache({
    conversationId,
    token,
  });

  return {
    conversation: payload.conversation,
    ok: true as const,
    status: result.status,
    url: result.url,
  };
}
