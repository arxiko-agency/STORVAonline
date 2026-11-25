import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useCallback, useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import { OTPInputContext, REGEXP_ONLY_DIGITS } from 'input-otp';
import { ArrowLeft, ChevronDown, Smartphone, ShieldCheck, CheckCircle2, LogOut } from 'lucide-react';
import { pageHead } from '@/lib/storva';
import { safeRedirect } from '@/lib/auth-redirect';
import { supabase } from '@/integrations/supabase/client';
import { InputOTP } from '@/components/ui/input-otp';
import { AuthNotice, AuthShell, Spinner, authInputClass, authPrimaryButtonClass } from '@/components/auth-shell';
import {
  COUNTRIES, DEFAULT_COUNTRY, OTP_LENGTH, RESEND_SECONDS, clearPending, countryByIso, formatCountdown, friendlyOtpError,
  isMobileVerified, maskMobile, readPending, savePending, secondsLeft, validateMobile, OTP_MESSAGES,
  type Country,
} from '@/lib/mobile-verification';

type Search = { redirect?: string | undefined };

export const Route = createFileRoute('/verify-mobile')({
  ssr: false, // the session lives in the browser
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s['redirect'] === 'string' ? { redirect: s['redirect'] } : {}),
  }),
  head: () => pageHead('Verify your mobile number', 'Confirm your mobile number with a one-time code to open your STORVA dashboard.'),
  beforeLoad: async ({ search }) => {
    // The auth server decides (getUser), not locally stored data.
    const { data } = await supabase.auth.getUser();
    const to = safeRedirect(search.redirect);
    if (!data.user) throw redirect({ to: '/login', search: { redirect: to } });
    if (isMobileVerified(data.user)) throw redirect({ to });
  },
  component: VerifyMobile,
});

type Step = 'phone' | 'code' | 'done';

/** One segment of the code input: filled / active states are driven by the OTP input's own context. */
function OtpSlot({ index }: { index: number }) {
  const { slots } = useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = slots[index] ?? { char: null, hasFakeCaret: false, isActive: false };
  return (
    <div className="auth-otp__slot" data-filled={char ? 'true' : 'false'} data-active={isActive ? 'true' : 'false'}>
      {char}
      {hasFakeCaret && <span className="pointer-events-none absolute h-6 w-px animate-caret-blink bg-[#0F3D2E]" aria-hidden="true" />}
    </div>
  );
}

function VerifyMobile() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('phone');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [national, setNational] = useState('');
  const [e164, setE164] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const verifyingRef = useRef(false);

  const remaining = secondsLeft(resendAt, now);
  const destination = () => safeRedirect(search.redirect);

  // Resume the code step after a reload (switching to the SMS app often reloads a mobile browser tab).
  useEffect(() => {
    const pending = readPending();
    if (pending) {
      setCountry(countryByIso(pending.iso));
      setNational(pending.national);
      setE164(pending.e164);
      setResendAt(pending.resendAt);
      setStep('code');
    }
  }, []);

  // Countdown tick, only while the resend lock is running.
  useEffect(() => {
    if (step !== 'code' || remaining <= 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [step, remaining]);

  function startCountdown(phone: string, c: Country, digits: string) {
    const until = Date.now() + RESEND_SECONDS * 1000;
    setNow(Date.now());
    setResendAt(until);
    savePending({ iso: c.iso, national: digits, e164: phone, resendAt: until });
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setNotice(null);
    const check = validateMobile(country, national);
    if (!check.ok) { setPhoneError(check.error); return; }
    setPhoneError(null);
    setSending(true);
    try {
      // The backend generates the one-time code and texts it to this number. Nothing is generated or checked here.
      const { error } = await supabase.auth.updateUser({ phone: check.e164 });
      if (error) { setNotice({ tone: 'error', text: friendlyOtpError(error) }); return; }
      setE164(check.e164);
      setNational(check.national);
      setCode('');
      startCountdown(check.e164, country, check.national);
      setStep('code');
      setNotice({ tone: 'info', text: `We sent a ${OTP_LENGTH}-digit code to ${maskMobile(check.e164)}.` });
    } catch (err) {
      setNotice({ tone: 'error', text: friendlyOtpError(err) });
    } finally {
      setSending(false);
    }
  }

  async function resend() {
    if (resending || remaining > 0 || !e164) return;
    setNotice(null);
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'phone_change', phone: e164 });
      if (error) { setNotice({ tone: 'error', text: friendlyOtpError(error) }); return; }
      setCode('');
      startCountdown(e164, country, national);
      setNotice({ tone: 'info', text: `A new code is on its way to ${maskMobile(e164)}.` });
    } catch (err) {
      setNotice({ tone: 'error', text: friendlyOtpError(err) });
    } finally {
      setResending(false);
    }
  }

  const verify = useCallback(async (token: string) => {
    if (verifyingRef.current || token.length !== OTP_LENGTH || !e164) return;
    verifyingRef.current = true;
    setVerifying(true);
    setNotice(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: e164, token, type: 'phone_change' });
      if (error) {
        setCode('');
        setNotice({ tone: 'error', text: friendlyOtpError(error) });
        return;
      }
      // Never trust the response alone: ask the auth server whether the number is now confirmed, and refresh the token
      // so server functions see the verified number.
      await supabase.auth.refreshSession();
      const { data } = await supabase.auth.getUser();
      if (!isMobileVerified(data.user)) {
        setCode('');
        setNotice({ tone: 'error', text: OTP_MESSAGES.generic });
        return;
      }
      clearPending();
      setStep('done');
      window.setTimeout(() => void navigate({ to: destination(), replace: true }), 900);
    } catch (err) {
      setCode('');
      setNotice({ tone: 'error', text: friendlyOtpError(err) });
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e164]);

  function changeNumber() {
    clearPending();
    setStep('phone');
    setCode('');
    setNotice(null);
    setResendAt(0);
  }

  async function signOut() {
    clearPending();
    await supabase.auth.signOut();
    void navigate({ to: '/login', replace: true });
  }

  if (step === 'done') {
    return (
      <AuthShell>
        <div className="py-6 text-center" role="status">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF5F0] text-[#0F3D2E]">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="font-serif text-[32px] leading-tight font-normal text-[#1F2A24]">Mobile number verified</h1>
          <p className="mt-2 flex items-center justify-center gap-2 text-sm text-[#1F2A24]/60">
            <Spinner className="h-3.5 w-3.5 text-[#0F3D2E]" /> Taking you to your dashboard…
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-7">
        <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF5F0] text-[#0F3D2E] ring-1 ring-[#0F3D2E]/10">
          <Smartphone className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0F3D2E]/70">Step 2 of 3 · Account security</p>
        <h1 className="font-serif text-[30px] leading-[1.1] tracking-tight font-normal text-[#1F2A24] sm:text-[32px]">
          {step === 'phone' ? 'Verify your mobile number' : 'Enter the 6-digit code'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#1F2A24]/60">
          {step === 'phone'
            ? 'One quick step to protect your store. We’ll text you a code to confirm it’s really you.'
            : <>We sent a code to <span className="font-semibold text-[#1F2A24]">{maskMobile(e164)}</span>. It can take a few seconds to arrive.</>}
        </p>
      </div>

      {step === 'phone' && (
        <form onSubmit={e => void sendCode(e)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="mobile-number" className="block text-xs font-semibold text-[#1F2A24]">Mobile number</label>
            <div className="auth-phone" data-invalid={phoneError ? 'true' : undefined}>
              {/* Native select drawn invisibly over a compact flag + code: accessible and easy to use on any phone */}
              <div className="auth-phone__country">
                <div className="flex h-[52px] items-center justify-between gap-1 px-3 text-[15px] font-semibold text-[#1F2A24]" aria-hidden="true">
                  <span className="flex items-center gap-1.5"><span className="text-lg leading-none">{country.flag}</span>+{country.dial}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#1F2A24]/45" />
                </div>
                <select
                  aria-label="Country code"
                  value={country.iso}
                  disabled={sending}
                  onChange={e => { setCountry(countryByIso(e.target.value)); setPhoneError(null); }}
                  className="absolute inset-0 h-full w-full cursor-pointer rounded-l-[13px] text-base opacity-0 disabled:cursor-not-allowed"
                >
                  {COUNTRIES.map(c => <option key={c.iso} value={c.iso}>{c.flag} {c.name} (+{c.dial})</option>)}
                </select>
              </div>
              <input
                id="mobile-number"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                autoFocus
                placeholder={country.example}
                maxLength={20}
                value={national}
                disabled={sending}
                aria-invalid={phoneError ? true : undefined}
                aria-describedby={phoneError ? 'mobile-error' : 'mobile-hint'}
                onChange={e => { setNational(e.target.value.replace(/[^\d\s\-().+]/g, '')); if (phoneError) setPhoneError(null); }}
                onBlur={() => { if (national.trim()) { const c = validateMobile(country, national); setPhoneError(c.ok ? null : c.error); } }}
                className="auth-phone__input"
              />
            </div>
            {phoneError
              ? <p id="mobile-error" role="alert" className="text-xs font-medium text-rose-700">{phoneError}</p>
              : <p id="mobile-hint" className="text-xs text-[#1F2A24]/50">We’ll send an SMS with a code. Standard message rates may apply.</p>}
          </div>

          <button type="submit" disabled={sending} className={authPrimaryButtonClass}>
            {sending ? <span className="inline-flex items-center gap-2"><Spinner />Sending code…</span> : 'Send OTP'}
          </button>

          {notice && <AuthNotice tone={notice.tone}>{notice.text}</AuthNotice>}
        </form>
      )}

      {step === 'code' && (
        <div className="space-y-5">
          <div>
            <label htmlFor="otp-input" className="sr-only">One-time code</label>
            <InputOTP
              id="otp-input"
              maxLength={OTP_LENGTH}
              value={code}
              onChange={v => { setCode(v); if (notice?.tone === 'error') setNotice(null); }}
              onComplete={v => void verify(v)}
              pattern={REGEXP_ONLY_DIGITS}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              disabled={verifying}
              containerClassName="w-full"
            >
              <div className="auth-otp" data-error={notice?.tone === 'error' ? 'true' : undefined}>
                {Array.from({ length: OTP_LENGTH }, (_, i) => <OtpSlot key={i} index={i} />)}
              </div>
            </InputOTP>
          </div>

          <button
            type="button"
            onClick={() => void verify(code)}
            disabled={verifying || code.length !== OTP_LENGTH}
            className={authPrimaryButtonClass}
          >
            {verifying ? <span className="inline-flex items-center gap-2"><Spinner />Verifying…</span> : 'Verify OTP'}
          </button>

          {notice && <AuthNotice tone={notice.tone}>{notice.text}</AuthNotice>}

          <div className="flex flex-wrap items-center justify-between gap-x-4 text-[13px]">
            <button
              type="button"
              onClick={changeNumber}
              disabled={verifying}
              className="inline-flex min-h-[44px] items-center gap-1.5 text-[#1F2A24]/60 hover:text-[#0F3D2E] focus:outline-none focus-visible:underline disabled:opacity-50 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Change number
            </button>
            {remaining > 0 ? (
              <span className="text-[#1F2A24]/55" aria-live="polite">Resend OTP in <span className="font-semibold tabular-nums text-[#1F2A24]">{formatCountdown(remaining)}</span></span>
            ) : (
              <button
                type="button"
                onClick={() => void resend()}
                disabled={resending || verifying}
                className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-[#0F3D2E] hover:underline focus:outline-none focus-visible:underline disabled:opacity-50 cursor-pointer"
              >
                {resending && <Spinner className="h-3.5 w-3.5" />}
                {resending ? 'Sending…' : 'Resend OTP'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 border-t border-[#EDF1EE] pt-3 text-xs text-[#1F2A24]/55">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#0F3D2E]" aria-hidden="true" />Your number is kept private.</span>
        <button type="button" onClick={() => void signOut()} className="inline-flex min-h-[44px] items-center gap-1.5 hover:text-[#0F3D2E] hover:underline focus:outline-none cursor-pointer">
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />Sign out
        </button>
      </div>
    </AuthShell>
  );
}
