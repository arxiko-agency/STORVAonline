/**
 * Mandatory mobile-number verification.
 *
 * The one-time code is generated, sent (SMS) and checked by the authentication backend itself
 * (phone change flow: `updateUser({ phone })` -> `verifyOtp({ type: 'phone_change' })`). Nothing here creates or
 * validates a code on the client, so a code can never be skipped or guessed locally. This module only holds the pure
 * helpers: country list, number validation, "is this account verified?" checks, and safe error messages.
 */

export const OTP_LENGTH = 6;
/** Matches the backend's minimum gap between two SMS sends to the same user. */
export const RESEND_SECONDS = 60;
/** Thrown by server functions when the caller has no verified mobile number. */
export const MOBILE_NOT_VERIFIED = 'MOBILE_NOT_VERIFIED: Verify your mobile number to continue.';

export type Country = {
  iso: string;
  name: string;
  dial: string;
  flag: string;
  /** Digits allowed after the country code, without the trunk "0". */
  min: number;
  max: number;
  pattern?: RegExp;
  example: string;
};

export const COUNTRIES: readonly Country[] = [
  { iso: 'IN', name: 'India', dial: '91', flag: '🇮🇳', min: 10, max: 10, pattern: /^[6-9]\d{9}$/, example: '98765 43210' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '971', flag: '🇦🇪', min: 9, max: 9, example: '50 123 4567' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '966', flag: '🇸🇦', min: 9, max: 9, example: '51 234 5678' },
  { iso: 'QA', name: 'Qatar', dial: '974', flag: '🇶🇦', min: 8, max: 8, example: '3123 4567' },
  { iso: 'KW', name: 'Kuwait', dial: '965', flag: '🇰🇼', min: 8, max: 8, example: '5012 3456' },
  { iso: 'OM', name: 'Oman', dial: '968', flag: '🇴🇲', min: 8, max: 8, example: '9212 3456' },
  { iso: 'BH', name: 'Bahrain', dial: '973', flag: '🇧🇭', min: 8, max: 8, example: '3612 3456' },
  { iso: 'SG', name: 'Singapore', dial: '65', flag: '🇸🇬', min: 8, max: 8, example: '8123 4567' },
  { iso: 'MY', name: 'Malaysia', dial: '60', flag: '🇲🇾', min: 9, max: 10, example: '12 345 6789' },
  { iso: 'US', name: 'United States', dial: '1', flag: '🇺🇸', min: 10, max: 10, example: '201 555 0123' },
  { iso: 'CA', name: 'Canada', dial: '1', flag: '🇨🇦', min: 10, max: 10, example: '506 234 5678' },
  { iso: 'GB', name: 'United Kingdom', dial: '44', flag: '🇬🇧', min: 10, max: 10, example: '7400 123456' },
  { iso: 'AU', name: 'Australia', dial: '61', flag: '🇦🇺', min: 9, max: 9, example: '412 345 678' },
  { iso: 'DE', name: 'Germany', dial: '49', flag: '🇩🇪', min: 10, max: 11, example: '151 2345 6789' },
  { iso: 'FR', name: 'France', dial: '33', flag: '🇫🇷', min: 9, max: 9, example: '6 12 34 56 78' },
  { iso: 'NP', name: 'Nepal', dial: '977', flag: '🇳🇵', min: 10, max: 10, example: '98 1234 5678' },
  { iso: 'LK', name: 'Sri Lanka', dial: '94', flag: '🇱🇰', min: 9, max: 9, example: '71 234 5678' },
  { iso: 'BD', name: 'Bangladesh', dial: '880', flag: '🇧🇩', min: 10, max: 10, example: '1712 345678' },
  { iso: 'PK', name: 'Pakistan', dial: '92', flag: '🇵🇰', min: 10, max: 10, example: '301 2345678' },
];

export const DEFAULT_COUNTRY: Country = COUNTRIES[0]!;

export function countryByIso(iso: string | null | undefined): Country {
  return COUNTRIES.find(c => c.iso === iso) ?? DEFAULT_COUNTRY;
}

/** Digits only, with a pasted "+91", "0091" or trunk "0" removed. */
export function normalizeNational(input: string, country: Country): string {
  let digits = input.replace(/\D/g, '');
  if (input.trim().startsWith('+') || input.trim().startsWith('00')) {
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith(country.dial)) digits = digits.slice(country.dial.length);
  } else if (digits.startsWith(country.dial) && digits.length > country.max) {
    digits = digits.slice(country.dial.length);
  }
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  return digits;
}

export type MobileCheck = { ok: true; national: string; e164: string } | { ok: false; error: string };

export function validateMobile(country: Country, input: string): MobileCheck {
  if (!input.trim()) return { ok: false, error: 'Enter your mobile number.' };
  if (/[^\d\s\-().+]/.test(input)) return { ok: false, error: 'Use digits only.' };
  const national = normalizeNational(input, country);
  const lengthText = country.min === country.max ? `${country.min} digits` : `${country.min}–${country.max} digits`;
  if (national.length < country.min || national.length > country.max) {
    return { ok: false, error: `Enter a valid ${country.name} mobile number (${lengthText}).` };
  }
  if (country.pattern && !country.pattern.test(national)) {
    return { ok: false, error: country.iso === 'IN' ? 'Indian mobile numbers start with 6, 7, 8 or 9.' : `Enter a valid ${country.name} mobile number.` };
  }
  return { ok: true, national, e164: `+${country.dial}${national}` };
}

export function maskMobile(e164: string): string {
  if (e164.length <= 7) return e164;
  return `${e164.slice(0, 3)}${'•'.repeat(e164.length - 7)}${e164.slice(-4)}`;
}

type PhoneUser = { phone?: string | null; phone_confirmed_at?: string | null } | null | undefined;

/** Account-level check on a user fetched from the auth server (`getUser`): a number exists AND it was confirmed by OTP. */
export function isMobileVerified(user: PhoneUser): boolean {
  return !!user && !!user.phone && !!user.phone_confirmed_at;
}

/**
 * Server-side check on verified token claims. The backend only copies a number into the token's `phone` claim after the
 * OTP was confirmed (a pending number stays in `phone_change`), so an empty claim means "not verified".
 */
export function hasVerifiedMobileClaim(claims: unknown): boolean {
  const phone = (claims as { phone?: unknown } | null | undefined)?.phone;
  return typeof phone === 'string' && phone.length > 0;
}

export function secondsLeft(resendAt: number, now: number): number {
  return Math.max(0, Math.ceil((resendAt - now) / 1000));
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const OTP_MESSAGES = {
  smsUnavailable: 'We couldn’t send the code right now. Please try again in a few minutes.',
  phoneTaken: 'This mobile number is already linked to another account. Use a different number.',
  rateLimited: 'Too many attempts. Please wait a minute before requesting another code.',
  invalidPhone: 'That mobile number doesn’t look valid. Check it and try again.',
  invalidOtp: 'That code is incorrect or has expired. Check it, or request a new code.',
  network: 'We couldn’t reach the server. Check your internet connection and try again.',
  sessionExpired: 'Your session has expired. Please log in again.',
  generic: 'Something went wrong. Please try again.',
} as const;

export type OtpMessageKey = keyof typeof OTP_MESSAGES;

/** Map any backend error to a fixed, customer-safe message. Raw backend text never reaches the UI. */
export function classifyOtpError(error: unknown): OtpMessageKey {
  const e = (typeof error === 'object' && error !== null ? error : { message: String(error ?? '') }) as {
    message?: unknown; code?: unknown; name?: unknown; status?: unknown;
  };
  const t = [e.code, e.name, e.message].filter(v => typeof v === 'string').join(' ').toLowerCase();
  const status = typeof e.status === 'number' ? e.status : 0;
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|offline/.test(t)) return 'network';
  if (status === 429 || /rate limit|over_sms_send_rate_limit|over_request_rate_limit|too many|security purposes/.test(t)) return 'rateLimited';
  if (/phone_exists|already (been )?registered|phone.*already|already.*phone/.test(t)) return 'phoneTaken';
  if (/sms_send_failed|phone_provider_disabled|sms provider|error sending|unsupported phone provider|phone.*(not enabled|disabled)/.test(t)) return 'smsUnavailable';
  if (/session_not_found|session.*(expired|missing)|jwt|not authenticated|authsessionmissing/.test(t)) return 'sessionExpired';
  if (/validation_failed.*phone|invalid.*phone|phone.*invalid|invalid format/.test(t)) return 'invalidPhone';
  if (/otp_expired|token has expired|expired or is invalid|invalid.*(token|otp|code)|otp.*invalid/.test(t)) return 'invalidOtp';
  return 'generic';
}

export function friendlyOtpError(error: unknown): string {
  return OTP_MESSAGES[classifyOtpError(error)];
}

/** Resume the code step after a page reload (switching to the SMS app often reloads a mobile tab). */
const PENDING_KEY = 'storva-mobile-pending';
export type PendingVerification = { iso: string; national: string; e164: string; resendAt: number };

export function savePending(p: PendingVerification): void {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { /* resuming is a convenience only */ }
}
export function readPending(): PendingVerification | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PendingVerification>;
    if (typeof p.iso === 'string' && typeof p.national === 'string' && typeof p.e164 === 'string' && typeof p.resendAt === 'number' && /^\+[1-9]\d{6,14}$/.test(p.e164)) {
      return { iso: p.iso, national: p.national, e164: p.e164, resendAt: p.resendAt };
    }
  } catch { /* ignore a corrupted value */ }
  return null;
}
export function clearPending(): void {
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* nothing stored */ }
}
