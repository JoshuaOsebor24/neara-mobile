import { requestMobileApi } from "@/services/api";
import {
    getMobileSession,
    resetMobileSession,
    updateMobileSession,
    type MobileUser,
} from "@/services/mobile-session";
import { buildActiveRoles, getAccountType } from "@/services/role-access";
import { createStoreWithBackend } from "@/services/store-api";

type BackendUser = {
  email: string;
  id: number | string;
  is_admin?: boolean;
  is_store_owner?: boolean;
  messages_sent_count?: number;
  name?: string | null;
  phone_number?: string | null;
  premium?: boolean;
  premium_status?: boolean | string | number | null;
  primary_store_id?: number | string | null;
  roles?: string[] | null;
};

type BackendStore = {
  address?: string | null;
  category?: string | null;
  country?: string | null;
  delivery_available?: boolean | null;
  description?: string | null;
  header_images?: string[] | null;
  id?: number | string;
  image_url?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  phone_number?: string | null;
  state?: string | null;
  store_name?: string | null;
};

type AuthResponse = {
  data?: {
    message?: string;
    token?: string;
    user?: BackendUser;
  };
  message?: string;
  token?: string;
  user?: BackendUser;
};

type ProSubscriptionInitResponse = {
  amount_kobo?: number;
  authorization_url?: string;
  currency?: string;
  message?: string;
  provider?: string;
  reference?: string;
};

type ProSubscriptionVerifyResponse = {
  data?: {
    message?: string;
    subscription?: {
      amount_kobo?: number;
      currency?: string;
      provider?: string;
      reference?: string;
      status?: string;
    };
    user?: BackendUser;
  };
  message?: string;
  subscription?: {
    amount_kobo?: number;
    currency?: string;
    provider?: string;
    reference?: string;
    status?: string;
  };
  user?: BackendUser;
};

type OwnerAuthResponse = AuthResponse & {
  data?: {
    message?: string;
    store?: BackendStore;
    token?: string;
    user?: BackendUser;
  };
  store?: BackendStore;
};

const SESSION_REFRESH_COOLDOWN_MS = 15000;
let lastSessionRefreshAt = 0;
let inflightSessionRefresh: Promise<void> | null = null;

function normalizeBackendRoles(
  value: BackendUser["roles"] | string | undefined,
) {
  if (Array.isArray(value)) {
    return value
      .filter((role): role is string => typeof role === "string")
      .map((role) => role.trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,\s{}]+/)
      .map((role) => role.replace(/"/g, "").trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function isTruthyFlag(value: unknown) {
  if (value === true || value === 1) {
    return true;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "t" ||
      normalized === "yes"
    );
  }

  return false;
}

function unwrapAuthUser(
  payload: AuthResponse | ProSubscriptionVerifyResponse | null | undefined,
) {
  return payload?.user ?? payload?.data?.user ?? null;
}

function unwrapAuthToken(
  payload: AuthResponse | OwnerAuthResponse | null | undefined,
) {
  return payload?.token ?? payload?.data?.token ?? null;
}

function unwrapAuthMessage(
  payload:
    | AuthResponse
    | OwnerAuthResponse
    | ProSubscriptionVerifyResponse
    | null
    | undefined,
) {
  return payload?.message ?? payload?.data?.message;
}

function normalizeCoordinate(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

export function buildSessionPatchFromAuthUser(
  user: BackendUser,
  token?: string | null,
): Partial<MobileUser> {
  const roles = normalizeBackendRoles(user.roles);
  const hasProRole = roles.includes("pro");
  const hasStoreOwnerRole = roles.includes("store_owner");
  const isPro =
    hasProRole ||
    isTruthyFlag(user.premium_status) ||
    isTruthyFlag(user.premium);
  const isStoreOwner = Boolean(
    user.is_store_owner || hasStoreOwnerRole || user.primary_store_id,
  );

  return {
    accountType: getAccountType(isPro),
    authToken: token ?? getMobileSession().authToken,
    email: user.email,
    id: String(user.id),
    isAdmin: Boolean(user.is_admin),
    isAuthenticated: true,
    isPro,
    isStoreOwner,
    messagesSentCount: Number(user.messages_sent_count ?? 0),
    name: user.name?.trim() || "",
    phoneNumber: user.phone_number?.trim() || "",
    primaryStoreId:
      user.primary_store_id !== null && user.primary_store_id !== undefined
        ? String(user.primary_store_id)
        : null,
    primaryStoreAddress: "",
    primaryStoreCategory: "",
    primaryStoreImageUrl: "",
    primaryStoreLatitude: null,
    primaryStoreLongitude: null,
    primaryStoreName: "",
    roles: buildActiveRoles(isPro, isStoreOwner),
    storePhoneNumber: "",
    storePlan: null,
  };
}

export function buildSessionPatchFromStore(
  store: BackendStore | null | undefined,
): Partial<MobileUser> {
  if (!store) {
    return {};
  }

  return {
    isStoreOwner: true,
    primaryStoreAddress: store.address?.trim() || "",
    primaryStoreCategory: store.category?.trim() || "",
    primaryStoreId:
      store.id !== null && store.id !== undefined ? String(store.id) : null,
    primaryStoreImageUrl: store.image_url?.trim() || "",
    primaryStoreLatitude: normalizeCoordinate(store.latitude),
    primaryStoreLongitude: normalizeCoordinate(store.longitude),
    primaryStoreName: store.store_name?.trim() || "",
    storePhoneNumber: store.phone_number?.trim() || "",
    storePlan: "basic",
  };
}

export async function loginWithBackend(payload: {
  email: string;
  password: string;
}) {
  const result = await requestMobileApi<AuthResponse>("/auth/login", {
    body: payload,
    method: "POST",
  });

  const user = unwrapAuthUser(result.data);
  const token = unwrapAuthToken(result.data);

  if (!result.ok || !user || !token) {
    return {
      error: result.ok ? "We couldn't sign you in right now." : result.error,
      ok: false as const,
    };
  }

  return {
    message: unwrapAuthMessage(result.data),
    ok: true as const,
    token,
    user,
  };
}

export async function signupWithBackend(payload: {
  email: string;
  name: string;
  password: string;
}) {
  const result = await requestMobileApi<AuthResponse>("/auth/signup", {
    body: payload,
    method: "POST",
  });

  const user = unwrapAuthUser(result.data);
  const token = unwrapAuthToken(result.data);

  if (!result.ok || !user || !token) {
    return {
      error: result.ok
        ? "We couldn't create your account right now."
        : result.error,
      ok: false as const,
    };
  }

  return {
    message: unwrapAuthMessage(result.data),
    ok: true as const,
    token,
    user,
  };
}

export async function registerOwnerWithBackend(payload: {
  owner: {
    email: string;
    full_name: string;
    password: string;
    phone_number: string;
  };
  store: {
    address: string;
    category: string;
    country?: string;
    description?: string;
    header_images?: (string | null)[];
    image_url?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    phone_number: string;
    state?: string;
    store_name: string;
  };
}) {
  const result = await requestMobileApi<OwnerAuthResponse>(
    "/auth/register-owner",
    {
      body: payload,
      method: "POST",
    },
  );

  if (result.ok && result.data.user && result.data.token) {
    return {
      message: result.data.message,
      ok: true as const,
      store: result.data.store,
      token: result.data.token,
      user: result.data.user,
    };
  }

  if (result.status !== 404 && result.status !== 405) {
    return {
      error: result.ok
        ? "We couldn't finish your store setup right now."
        : result.error,
      ok: false as const,
      status: result.status,
      store: result.data?.store ?? null,
      token: result.data?.token ?? null,
      user: result.data?.user ?? null,
    };
  }

  const signupResult = await signupWithBackend({
    email: payload.owner.email,
    name: payload.owner.full_name,
    password: payload.owner.password,
  });

  if (!signupResult.ok) {
    const loginResult = await loginWithBackend({
      email: payload.owner.email,
      password: payload.owner.password,
    });

    if (!loginResult.ok) {
      return {
        error: signupResult.error,
        ok: false as const,
        status: result.status,
        store: null,
        token: null,
        user: null,
      };
    }

    const storeResult = await createStoreWithBackend(
      loginResult.token,
      payload.store,
    );

    if (!storeResult.ok) {
      return {
        error: storeResult.error,
        ok: false as const,
        status: storeResult.status,
        store: storeResult.store,
        token: loginResult.token,
        user: loginResult.user,
      };
    }

    return {
      message: storeResult.message,
      ok: true as const,
      store: storeResult.store,
      token: loginResult.token,
      user: loginResult.user,
    };
  }

  const storeResult = await createStoreWithBackend(
    signupResult.token,
    payload.store,
  );

  if (!storeResult.ok) {
    return {
      error: storeResult.error,
      ok: false as const,
      status: storeResult.status,
      store: storeResult.store,
      token: signupResult.token,
      user: signupResult.user,
    };
  }

  return {
    message: storeResult.message ?? signupResult.message,
    ok: true as const,
    store: storeResult.store,
    token: signupResult.token,
    user: signupResult.user,
  };
}

export async function fetchCurrentUserFromBackend(token: string) {
  const result = await requestMobileApi<AuthResponse>("/auth/me", {
    method: "GET",
    token,
  });

  const user = unwrapAuthUser(result.data);

  if (!result.ok || !user) {
    return {
      error: result.ok
        ? "We couldn't refresh your account details right now."
        : result.error,
      ok: false as const,
      status: result.status,
    };
  }

  return {
    ok: true as const,
    user,
  };
}

export async function updateCurrentUserWithBackend(
  token: string,
  payload: {
    email: string;
    name: string;
    password?: string;
    phone_number?: string;
  },
) {
  const result = await requestMobileApi<AuthResponse>("/auth/me", {
    body: payload,
    method: "PATCH",
    token,
  });

  const user = unwrapAuthUser(result.data);

  if (!result.ok || !user) {
    return {
      error: result.ok
        ? "We couldn't save your account changes right now."
        : result.error,
      ok: false as const,
      status: result.status,
    };
  }

  return {
    message: unwrapAuthMessage(result.data),
    ok: true as const,
    user,
  };
}

export async function fetchOwnerPrimaryStoreFromBackend(token: string) {
  const result = await requestMobileApi<{ stores?: BackendStore[] }>(
    "/stores/owner/me",
    {
      method: "GET",
      token,
    },
  );

  if (!result.ok) {
    return {
      error: result.error,
      ok: false as const,
      status: result.status,
    };
  }

  if (!Array.isArray(result.data.stores)) {
    return {
      error: "We couldn't load your store details right now.",
      ok: false as const,
      status: result.status,
    };
  }

  return {
    ok: true as const,
    store: result.data.stores[0] ?? null,
  };
}

export async function upgradeToProWithBackend(token: string) {
  const result = await requestMobileApi<{
    user?: BackendUser;
    message?: string;
  }>("/auth/roles/pro", {
    method: "PATCH",
    token,
  });

  if (!result.ok || !result.data.user) {
    return {
      error: result.ok ? "We couldn't activate Pro right now." : result.error,
      ok: false as const,
    };
  }

  return {
    message: result.data.message,
    ok: true as const,
    user: result.data.user,
  };
}

export async function initializeProSubscriptionWithBackend(token: string) {
  const result = await requestMobileApi<ProSubscriptionInitResponse>(
    "/payments/subscriptions/initialize",
    {
      method: "POST",
      token,
    },
  );

  if (!result.ok || !result.data.reference) {
    return {
      error: result.ok
        ? "We couldn't start your upgrade right now."
        : result.error,
      ok: false as const,
      status: result.status,
    };
  }

  return {
    amountKobo: result.data.amount_kobo ?? 0,
    authorizationUrl: result.data.authorization_url ?? "",
    currency: result.data.currency ?? "NGN",
    message: result.data.message,
    ok: true as const,
    provider: result.data.provider ?? "mock",
    reference: result.data.reference,
  };
}

export async function verifyProSubscriptionWithBackend(
  token: string,
  reference: string,
) {
  const result = await requestMobileApi<ProSubscriptionVerifyResponse>(
    "/payments/subscriptions/verify",
    {
      body: { reference },
      method: "POST",
      token,
    },
  );

  const user = unwrapAuthUser(result.data);
  const subscription =
    result.data?.data?.subscription ?? result.data?.subscription ?? null;

  if (!result.ok || !user) {
    return {
      error: result.ok ? "We couldn't confirm your payment yet." : result.error,
      ok: false as const,
      status: result.status,
    };
  }

  return {
    message: unwrapAuthMessage(result.data),
    ok: true as const,
    subscription,
    user,
  };
}

export async function refreshMobileSessionFromBackend(options?: {
  force?: boolean;
}) {
  const now = Date.now();
  const force = Boolean(options?.force);

  if (inflightSessionRefresh) {
    return inflightSessionRefresh;
  }

  if (!force && now - lastSessionRefreshAt < SESSION_REFRESH_COOLDOWN_MS) {
    return;
  }

  const token = getMobileSession().authToken;

  if (!token) {
    return;
  }

  inflightSessionRefresh = (async () => {
    const userResult = await fetchCurrentUserFromBackend(token);

    if (!userResult.ok) {
      if (userResult.status === 401 || userResult.status === 403) {
        await resetMobileSession();
        lastSessionRefreshAt = Date.now();
      }

      return;
    }

    const nextUserPatch = buildSessionPatchFromAuthUser(userResult.user, token);
    let nextStorePatch: Partial<MobileUser> = {};

    if (nextUserPatch.isStoreOwner) {
      const ownerStoreResult = await fetchOwnerPrimaryStoreFromBackend(token);

      if (ownerStoreResult.ok && ownerStoreResult.store) {
        nextStorePatch = buildSessionPatchFromStore(ownerStoreResult.store);
      }
    }

    await updateMobileSession({
      ...nextUserPatch,
      ...nextStorePatch,
    });

    lastSessionRefreshAt = Date.now();
  })();

  try {
    await inflightSessionRefresh;
  } finally {
    inflightSessionRefresh = null;
  }
}
