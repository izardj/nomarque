export const SESSION_COOKIE = 'nomarque_session';
export const MAGIC_LINK_TTL_MINUTES = 15;
/** At most this many links per address within the TTL window. */
export const MAGIC_LINK_MAX_PER_WINDOW = 3;
export const SESSION_TTL_DAYS = 30;
/** lastSeenAt is refreshed at most this often. */
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60_000;
