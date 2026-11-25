import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Lock, ShieldCheck, Smartphone, Store } from 'lucide-react';
import { pageHead } from '@/lib/storva';
import {
  forgetRememberedRedirect, isLocalDevHost, loginReturnUrl, readAuthError, readRememberedRedirect, rememberRedirect, safeRedirect,
} from '@/lib/auth-redirect';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { AUTH_MESSAGES, friendlyAuthError } from '@/lib/auth-errors';
import { isMobileVerified } from '@/lib/mobile-verification';
import { AuthNotice, AuthShell, Spinner } from '@/components/auth-shell';

type Search = { redirect?: string | undefined; reason?: 'session_expired' | undefined };
type Mode = 'login' | 'signup' | 'forgot' | 'link';

export const Route = createFileRoute('/login')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s['redirect'] === 'string' ? { redirect: s['redirect'] } : {}),
    ...(s['reason'] === 'session_expired' ? { reason: 'session_expired' as const } : {}),
  }),
  head: () => pageHead('Welcome to STORVA', 'Securely sign in to your STORVA store with Google. Mobile number verification keeps your account safe.'),
  component: Login,
});

function GoogleLogo() {
  return (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

function Login() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [localHost, setLocalHost] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const destination = () => safeRedirect(search.redirect ?? readRememberedRedirect());
  const leaving = useRef(false);
  const oauthBusy = useRef(false);
  function goToStore(user?: { phone?: string | null; phone_confirmed_at?: string | null } | null) {
    // getSession() and the SIGNED_IN event can both fire for the same sign-in; navigate only once.
    if (leaving.current) return;
    leaving.current = true;
    const to = destination();
    forgetRememberedRedirect();
    // Mobile verification is mandatory: a signed-in account without a confirmed number goes to the OTP page first.
    // (The dashboard and every server function enforce the same rule, so this is only the short path.)
    if (user && !isMobileVerified(user)) {
      void navigate({ to: '/verify-mobile', search: { redirect: to }, replace: true });
      return;
    }
    void navigate({ to, replace: true });
  }

  // The protected-page guard asks the server (getUser); getSession only reads local storage. Trusting the local
  // session here would bounce between /login and /dashboard whenever a stored session is rejected, so confirm first.
  async function continueIfSessionValid(isActive: () => boolean) {
    const { data, error } = await supabase.auth.getUser();
    if (!isActive()) return;
    if (data.user) { goToStore(data.user); return; }
    const status = (error as { status?: number } | null)?.status;
    if (status === 401 || status === 403 || error?.name === 'AuthSessionMissingError') {
      await supabase.auth.signOut({ scope: 'local' }); // drop the dead session so the button works
    }
    // Any other failure (offline) leaves the page visible instead of looping.
  }

  // Already signed in (or returning from Google): continue to the store.
  useEffect(() => {
    let active = true;
    const isActive = () => active;
    setLocalHost(isLocalDevHost(window.location.hostname));
    if (search.redirect) rememberRedirect(safeRedirect(search.redirect));
    // Returning from a cancelled Google sign-in, or a session the server rejected: explain, then tidy the address bar.
    const authError = readAuthError(window.location.search, window.location.hash);
    if (authError) setNotice({ tone: 'error', text: authError });
    else if (search.reason === 'session_expired') setNotice({ tone: 'info', text: AUTH_MESSAGES.sessionExpired });
    if (authError || search.reason) {
      const clean = new URL(window.location.href);
      ['error', 'error_code', 'error_description', 'reason'].forEach(k => clean.searchParams.delete(k));
      clean.hash = '';
      window.history.replaceState(null, '', clean.pathname + clean.search);
    }
    supabase.auth.getSession().then(({ data }) => { if (data.session) void continueIfSessionValid(isActive); });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Defer: calling the auth API inside this callback can deadlock the client.
      if (event === 'SIGNED_IN' && session) setTimeout(() => void continueIfSessionValid(isActive), 0);
    });
    // Coming back with the browser Back button (page restored from cache) must not leave Google stuck on "Connecting".
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) { oauthBusy.current = false; setGoogleLoading(false); }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => { active = false; data.subscription.unsubscribe(); window.removeEventListener('pageshow', onPageShow); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signInWithGoogle() {
    if (oauthBusy.current) return; // ignore double taps while the provider is opening
    oauthBusy.current = true;
    setGoogleLoading(true);
    setNotice(null);
    const returnUrl = loginReturnUrl(window.location.origin);
    let leavingForProvider = false;
    try {
      // The hosted project's Google OAuth is served by its managed broker, which only exists on the hosted preview or
      // published domain. Do not fall back to the database client's own OAuth: that bypasses the broker and fails.
      // No network probe before starting: an await before the redirect/popup makes mobile Safari block it.
      if (isLocalDevHost(window.location.hostname)) {
        setNotice({ tone: 'info', text: 'Google sign-in works on your hosted preview or published site, not on localhost.' });
        return;
      }

      const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: returnUrl });
      if (result.redirected) {
        // Full-page redirect to Google; /login finishes the sign-in on return.
        // Stay locked until the page unloads, otherwise a second tap starts a duplicate attempt.
        leavingForProvider = true;
        return;
      }
      if (result.error) {
        // Covers cancellation (closed popup / consent denied), provider not configured, bad callback and network errors.
        setNotice({ tone: 'error', text: friendlyAuthError(result.error, 'oauth') });
        return;
      }
      const { data: current } = await supabase.auth.getUser();
      goToStore(current.user);
    } catch (err) {
      setNotice({ tone: 'error', text: friendlyAuthError(err, 'oauth') });
    } finally {
      if (!leavingForProvider) {
        oauthBusy.current = false;
        setGoogleLoading(false);
      }
    }
  }

  const STEPS = [
    { icon: Lock, label: 'Sign in with Google' },
    { icon: Smartphone, label: 'Verify your mobile' },
    { icon: Store, label: 'Open your store' },
  ] as const;

  return (
    <AuthShell>
      <div className="text-center sm:text-left">
        <h1 className="font-serif text-[34px] leading-[1.08] tracking-tight text-[#1F2A24] font-normal sm:text-[38px]">
          Welcome to <span className="italic text-[#0F3D2E]">STORVA</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#1F2A24]/65">
          Securely access your store. Sign in with your Google account to manage products, orders and customers.
        </p>
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={googleLoading}
          aria-busy={googleLoading}
          className="auth-google"
        >
          <span className="auth-google__logo">
            {googleLoading ? <Spinner className="h-[18px] w-[18px] text-[#0F3D2E]" /> : <GoogleLogo />}
            <span className="auth-google__dot" aria-hidden="true" />
          </span>
          <span className="auth-google__label">{googleLoading ? 'Connecting to Google…' : 'Continue with Google'}</span>
          <span className="auth-google__arrow" aria-hidden="true"><ArrowRight /></span>
          <span className="auth-google__bar" aria-hidden="true" />
        </button>

        <p className="mt-3.5 flex items-center justify-center gap-1.5 text-center text-[12px] text-[#1F2A24]/55">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#0F3D2E]" aria-hidden="true" />
          <span>Secure sign-in. We never see your Google password.</span>
        </p>

        {localHost && (
          <p className="mt-3 text-center text-[12px] leading-relaxed text-[#1F2A24]/55">
            Google sign-in works on your hosted preview or published site, not on localhost.
          </p>
        )}

        {notice && <div className="mt-4"><AuthNotice tone={notice.tone}>{notice.text}</AuthNotice></div>}
      </div>

      <div className="auth-divider" role="separator" aria-hidden="true">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1F2A24]/40">Account security</span>
      </div>

      {/* Mobile verification is required: say so clearly before the person signs in */}
      <section aria-labelledby="mv-title" className="mt-5 rounded-2xl border border-[#D6E6DC] bg-[#F3F9F5] p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#0F3D2E] shadow-[0_1px_2px_rgba(15,61,46,0.08)] ring-1 ring-[#0F3D2E]/10">
            <Smartphone className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="mv-title" className="text-sm font-semibold text-[#1F2A24]">Mobile number verification is required</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[#1F2A24]/65">
              To keep your store and customer data safe, you’ll confirm your mobile number with a one-time code right after signing in.
            </p>
          </div>
        </div>

        <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="How sign-in works">
          {STEPS.map(({ icon: Icon, label }, i) => (
            <li key={label} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/80 px-1.5 py-2.5 text-center ring-1 ring-[#0F3D2E]/8">
              <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-[#0F3D2E] text-white">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-[#0F3D2E] ring-1 ring-[#0F3D2E]/20">{i + 1}</span>
              </span>
              <span className="text-[11px] font-medium leading-tight text-[#1F2A24]/70">{label}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-[#1F2A24]/50">
        By continuing, you agree to our{' '}
        <Link to="/terms" className="font-medium text-[#0F3D2E] underline-offset-2 hover:underline">Terms</Link>
        {' '}and{' '}
        <Link to="/privacy" className="font-medium text-[#0F3D2E] underline-offset-2 hover:underline">Privacy Policy</Link>.
      </p>
    </AuthShell>
  );
}
