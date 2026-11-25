/** The one place the login page path is spelled. The route file is `src/routes/login.tsx`, so it is `/login`, never `/Login`. */
export const LOGIN_PATH = '/login';

/** The mobile verification page. Like /login it is never a destination, or the redirect would loop. */
export const VERIFY_MOBILE_PATH = '/verify-mobile';

function isLoginPath(value: string): boolean {
  let path = value.split(/[?#]/)[0] ?? '';
  try { path = decodeURIComponent(path); } catch { /* keep the raw path */ }
  const clean = path.toLowerCase().replace(/\/+$/, '');
  return clean === LOGIN_PATH || clean === VERIFY_MOBILE_PATH;
}

/**
 * Only allow same-origin relative paths after sign-in (prevents open redirects).
 * The login page itself is never a destination: "/login?redirect=/login" would otherwise
 * send a signed-in visitor from /login to /login forever.
 */
export function safeRedirect(value: unknown, fallback = '/dashboard'): string {
  if (typeof value !== 'string' || value.length > 512) return fallback;
  // Browsers drop tabs/newlines and treat "\\" like "/", so "/\t/evil.com" or "/\\evil.com" would become "//evil.com".
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (isLoginPath(value)) return fallback;
  return value;
}

const REDIRECT_KEY = 'storva-after-login';

/**
 * Remember where to go after sign-in across the full-page Google redirect. sessionStorage can throw
 * (blocked storage inside the Lovable preview iframe, private modes), and that must never break login.
 */
export function rememberRedirect(path: string): void {
  try { sessionStorage.setItem(REDIRECT_KEY, path); } catch { /* destination falls back to /dashboard */ }
}
export function readRememberedRedirect(): string | null {
  try { return sessionStorage.getItem(REDIRECT_KEY); } catch { return null; }
}
export function forgetRememberedRedirect(): void {
  try { sessionStorage.removeItem(REDIRECT_KEY); } catch { /* nothing stored */ }
}

/** Absolute URL that sign-in links, magic links and OAuth providers send the user back to. */
export function loginReturnUrl(origin: string): string {
  return `${origin.replace(/\/+$/, '')}${LOGIN_PATH}`;
}

/**
 * True on a developer's own machine (localhost, loopback, private LAN address).
 * Lovable's OAuth broker (`/~oauth/initiate`) is only served on Lovable-hosted domains, so it
 * does not exist on these hosts and requesting it ends on the app's 404 page.
 */
export function isLocalDevHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h === '127.0.0.1' ||
    h === '::1' ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

/** Friendly message for an auth error sent back in the URL. Null when there is none. */
export { readCallbackError as readAuthError } from './auth-errors';
