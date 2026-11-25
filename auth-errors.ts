/**
 * Customer-facing sign-in messages. Raw backend errors, codes and stack traces never reach the UI:
 * every auth failure is mapped to one of these fixed strings.
 */
export const AUTH_MESSAGES = {
  googleFailed: 'Google sign-in didn’t work. Please try again.',
  googleCancelled: 'Google sign-in was cancelled. You can try again any time.',
  providerNotConfigured: 'Google sign-in isn’t available right now. Please try again in a few minutes.',
  invalidCallback: 'This sign-in link isn’t valid for this site. Please start again from the login page.',
  network: 'We couldn’t reach the server. Check your internet connection and try again.',
  sessionExpired: 'Your session has expired. Please log in again.',
  accountExists: 'An account with this email already exists. Log in instead, or reset your password.',
  emailNotVerified: 'Please confirm your email first. Check your inbox for the confirmation link.',
  invalidCredentials: 'That email and password don’t match. Please try again.',
  linkExpired: 'That email link has expired or was already used. Please request a new one.',
  rateLimited: 'Too many attempts. Please wait a minute and try again.',
  weakPassword: 'Choose a stronger password with at least 8 characters.',
  generic: 'Something went wrong. Please try again.',
} as const;

export type AuthMessageKey = keyof typeof AUTH_MESSAGES;

type ErrorLike = { message?: unknown; code?: unknown; status?: unknown; name?: unknown } | null | undefined;

function text(e: ErrorLike): string {
  if (!e) return '';
  return [e.code, e.name, e.message].filter(v => typeof v === 'string').join(' ').toLowerCase();
}

/** Classify any auth error (Supabase, OAuth broker, fetch) into a safe message key. */
export function classifyAuthError(error: unknown, context: 'oauth' | 'email' = 'email'): AuthMessageKey {
  const e = (typeof error === 'object' ? error : { message: String(error ?? '') }) as ErrorLike;
  const t = text(e);
  const status = typeof e?.status === 'number' ? e.status : 0;
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|offline/.test(t)) return 'network';
  if (/cancel|closed|popup_closed|user denied|access_denied/.test(t)) return 'googleCancelled';
  if (/provider is not enabled|unsupported provider|provider.*not.*(enabled|configured)|validation_failed.*provider/.test(t)) return 'providerNotConfigured';
  if (/redirect.*(not allowed|mismatch|invalid)|invalid.*redirect|redirect_uri|callback/.test(t)) return 'invalidCallback';
  if (/email_not_confirmed|email not confirmed|not.*verified/.test(t)) return 'emailNotVerified';
  if (/user_already_exists|already registered|already exists|email_exists|identity_already_exists/.test(t)) return 'accountExists';
  if (/session_not_found|session.*expired|jwt expired|refresh_token_not_found|invalid refresh token|session_expired/.test(t)) return 'sessionExpired';
  if (/otp_expired|link.*(expired|invalid)|flow_state_expired/.test(t)) return 'linkExpired';
  if (/invalid_credentials|invalid login credentials/.test(t)) return 'invalidCredentials';
  if (/weak_password|password should be/.test(t)) return 'weakPassword';
  if (status === 429 || /rate limit|too many/.test(t)) return 'rateLimited';
  return context === 'oauth' ? 'googleFailed' : 'generic';
}

export function friendlyAuthError(error: unknown, context: 'oauth' | 'email' = 'email'): string {
  return AUTH_MESSAGES[classifyAuthError(error, context)];
}

/**
 * Friendly message for an error the backend or Google sent back in the callback URL
 * (`?error=...` or `#error=...`), or for a `?reason=` we set ourselves. Null when there is none.
 */
export function readCallbackError(search: string, hash: string): string | null {
  const q = new URLSearchParams(search);
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  if (q.get('reason') === 'session_expired') return AUTH_MESSAGES.sessionExpired;
  const error = q.get('error') ?? h.get('error');
  if (!error) return null;
  const code = q.get('error_code') ?? h.get('error_code') ?? '';
  const description = (q.get('error_description') ?? h.get('error_description') ?? '').replace(/\+/g, ' ');
  const all = `${error} ${code} ${description}`.toLowerCase();
  if (/expired|otp|already used/.test(all) && !/session/.test(all)) return AUTH_MESSAGES.linkExpired;
  if (error === 'access_denied' && !/provider|redirect/.test(all)) return AUTH_MESSAGES.googleCancelled;
  return AUTH_MESSAGES[classifyAuthError({ code, message: `${error} ${description}` }, 'oauth')];
}
