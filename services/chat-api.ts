import { requestMobileApi } from "@/services/api";

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

function unwrapEnvelope<T>(payload: ApiEnvelope<T> | T | null | undefined) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("data" in payload) {
    return (payload.data ?? null) as T | null;
  }

  return payload as T;
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
  const result = await requireChatRequest<ApiEnvelope<ChatListResponse>>(`/chats?role=${role}`, {
    method: "GET",
    token,
  });
  const payload = result.ok ? unwrapEnvelope<ChatListResponse>(result.data) : null;

  if (!result.ok) {
    return {
      conversations: [] as ChatConversationSummary[],
      error: result.error,
      ok: false as const,
      status: result.status,
      url: result.url,
    };
  }

  return {
    conversations: payload?.conversations ?? [],
    ok: true as const,
    status: result.status,
    url: result.url,
  };
}

export async function fetchStoreChatPreview(token: string, storeId: string) {
  const result = await requireChatRequest<ApiEnvelope<ChatPreviewResponse>>(
    `/chats/store/${storeId}`,
    {
      method: "GET",
      token,
    },
  );
  const payload = result.ok ? unwrapEnvelope<ChatPreviewResponse>(result.data) : null;

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

  return {
    conversation: payload?.conversation ?? null,
    ok: true as const,
    status: result.status,
    store: payload?.store ?? null,
    url: result.url,
  };
}

export async function fetchChatConversation(token: string, conversationId: string) {
  const result = await requireChatRequest<ApiEnvelope<ChatDetailResponse>>(
    `/chats/${conversationId}`,
    {
      method: "GET",
      token,
    },
  );
  const payload = result.ok ? unwrapEnvelope<ChatDetailResponse>(result.data) : null;

  if (!result.ok || !payload?.conversation) {
    return {
      conversation: null,
      error: result.ok ? "Could not load this conversation." : result.error,
      ok: false as const,
      status: result.status,
      url: result.url,
    };
  }

  return {
    conversation: payload.conversation,
    ok: true as const,
    status: result.status,
    url: result.url,
  };
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
  const payload = result.ok ? unwrapEnvelope<ChatSendResponse>(result.data) : null;

  if (!result.ok || !payload?.conversation) {
    return {
      conversation: null,
      error: result.ok ? "Could not send this message." : result.error,
      ok: false as const,
      status: result.status,
      url: result.url,
      user: result.ok ? payload?.user ?? null : null,
    };
  }

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
  const payload = result.ok ? unwrapEnvelope<ChatSendResponse>(result.data) : null;

  if (!result.ok || !payload?.conversation) {
    return {
      conversation: null,
      error: result.ok ? "Could not send this reply." : result.error,
      ok: false as const,
      status: result.status,
      url: result.url,
      user: result.ok ? payload?.user ?? null : null,
    };
  }

  return {
    conversation: payload.conversation,
    ok: true as const,
    status: result.status,
    url: result.url,
    user: payload.user ?? null,
  };
}

export async function markConversationRead(token: string, conversationId: string) {
  const result = await requireChatRequest<ApiEnvelope<ChatDetailResponse>>(
    `/chats/${conversationId}/read`,
    {
      method: "POST",
      token,
    },
  );
  const payload = result.ok ? unwrapEnvelope<ChatDetailResponse>(result.data) : null;

  if (!result.ok || !payload?.conversation) {
    return {
      conversation: null,
      error: result.ok ? "Could not update this conversation." : result.error,
      ok: false as const,
      status: result.status,
      url: result.url,
    };
  }

  return {
    conversation: payload.conversation,
    ok: true as const,
    status: result.status,
    url: result.url,
  };
}
