export const ACTIVE_ROLE_USER = "user";
export const ACTIVE_ROLE_PRO = "pro";
export const ACTIVE_ROLE_STORE_OWNER = "store_owner";

export type ActiveRole =
  | typeof ACTIVE_ROLE_USER
  | typeof ACTIVE_ROLE_PRO
  | typeof ACTIVE_ROLE_STORE_OWNER;

export const ACTIVE_ROLE_ORDER: readonly ActiveRole[] = [
  ACTIVE_ROLE_USER,
  ACTIVE_ROLE_PRO,
  ACTIVE_ROLE_STORE_OWNER,
];

export const NEARA_PRO_BADGE_LABEL = "Pro";
export const NEARA_STORE_OWNER_BADGE_LABEL = "Store Owner";
export const NEARA_PRO_PLAN_LABEL = "Pro User";
export const NEARA_FREE_PLAN_LABEL = "Free Plan";
export const NEARA_PRO_PRICE_LABEL = "₦1,000 / month";
export const NEARA_PRO_TRUST_TEXT = "Cancel anytime. No hidden fees.";
export const NEARA_FREE_CHAT_LIMIT = 2;
export const NEARA_PRO_LIMIT_MESSAGE = "You’ve reached your free limit (2 messages)";
export const NEARA_ONE_FREE_MESSAGE_LEFT = "You have 1 message left";
export const NEARA_FREE_LIMIT_REACHED = "You have reached your limit";

export function buildActiveRoles(isPro: boolean, isStoreOwner = false): ActiveRole[] {
  const roles: ActiveRole[] = [ACTIVE_ROLE_USER];

  if (isPro) {
    roles.push(ACTIVE_ROLE_PRO);
  }

  if (isStoreOwner) {
    roles.push(ACTIVE_ROLE_STORE_OWNER);
  }

  return roles;
}

export function getAccountType(isPro: boolean): ActiveRole {
  return isPro ? ACTIVE_ROLE_PRO : ACTIVE_ROLE_USER;
}

export function getFreeMessagesRemaining(messagesSentCount: number, isPro: boolean) {
  if (isPro) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, NEARA_FREE_CHAT_LIMIT - Math.max(0, messagesSentCount));
}
