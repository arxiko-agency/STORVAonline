import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { AlertCircle, ArrowLeft, Box, CheckCircle2, Check, TrendingUp } from 'lucide-react';

/**
 * Shared frame for the sign-in pages (login, mobile verification).
 * Warm off-white page, deep forest green brand panel, charcoal text. CSS only: no images, no extra network requests.
 */

export const AUTH_INK = '#1F2A24'; // dark charcoal
export const AUTH_GREEN = '#0F3D2E'; // deep forest green

export const authInputClass =
  'w-full h-12 px-4 rounded-xl border border-[#D9E2DC] bg-white text-[#1F2A24] text-base placeholder:text-[#1F2A24]/35 ' +
  'focus:outline-none focus:border-[#0F3D2E] focus:ring-4 focus:ring-[#0F3D2E]/10 transition-all duration-200 disabled:opacity-60';

/** Premium green action button; the styling lives in styles.css (.auth-primary). */
export const authPrimaryButtonClass = 'auth-primary';

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export function AuthNotice({ tone, children }: { tone: 'info' | 'error' | 'success'; children: ReactNode }) {
  const styles =
    tone === 'error'
      ? 'bg-rose-50 border-rose-200 text-rose-800'
      : 'bg-[#EEF5F0] border-[#0F3D2E]/20 text-[#0F3D2E]';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`p-3.5 rounded-xl text-[13px] leading-relaxed flex items-start gap-2.5 border ${styles}`}>
      {tone === 'error'
        ? <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
        : <CheckCircle2 className="w-4 h-4 text-[#0F3D2E] shrink-0 mt-0.5" aria-hidden="true" />}
      <div className="flex-1 font-medium">{children}</div>
    </div>
  );
}

function BrandLockup({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" aria-label="STORVA home" className="inline-flex items-center gap-2.5 focus:outline-none group">
      <span
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105 ${
          light ? 'bg-white/12 ring-1 ring-white/25 text-white' : 'bg-gradient-to-br from-[#17543F] to-[#0F3D2E] text-white shadow-[0_8px_20px_-6px_rgba(15,61,46,0.5)]'
        }`}
      >
        <Box className="w-5 h-5" strokeWidth={1.9} />
      </span>
      <span className={`text-[22px] font-extrabold tracking-tight ${light ? 'text-white' : 'text-[#1F2A24]'}`}>
        STORVA<span className={light ? 'text-[#7BD3A8]' : 'text-[#17543F]'}>.</span>
      </span>
    </Link>
  );
}

const POINTS = [
  'Products, orders and customers in one calm workspace',
  'Online payments, shipping and WhatsApp built in',
  'A storefront that looks as good as your brand',
];

function BrandPanel() {
  return (
    <aside
      className="relative hidden lg:flex flex-col justify-between overflow-hidden rounded-[28px] p-11 xl:p-14 text-white
                 bg-[linear-gradient(155deg,#12493A_0%,#0F3D2E_48%,#0A2A20_100%)] shadow-[0_30px_70px_-30px_rgba(10,42,32,0.7)]"
    >
      {/* Decoration: soft glows, fine grid and rings (purely visual) */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-24 -right-24 h-[360px] w-[360px] rounded-full bg-[#2FA573]/25 blur-[90px]" />
        <div className="absolute -bottom-28 -left-20 h-[320px] w-[320px] rounded-full bg-[#7BD3A8]/12 blur-[90px]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_70%_60%_at_30%_30%,#000,transparent)]" />
        <div className="absolute right-[-180px] top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full border border-white/[0.07]" />
        <div className="absolute right-[-260px] top-1/2 h-[700px] w-[700px] -translate-y-1/2 rounded-full border border-white/[0.04]" />
      </div>

      <div className="relative">
        <BrandLockup light />
      </div>

      <div className="relative max-w-[460px]">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[#9FE0BE]">FOR MODERN MERCHANTS</p>
        <h2 className="mt-4 font-serif text-[46px] xl:text-[54px] leading-[1.04] tracking-tight">
          Run your store <span className="italic text-[#9FE0BE]">beautifully.</span>
        </h2>
        <ul className="mt-8 space-y-3.5">
          {POINTS.map(text => (
            <li key={text} className="flex items-start gap-3 text-[15px] leading-snug text-white/80">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/20">
                <Check className="h-3 w-3 text-[#9FE0BE]" strokeWidth={3} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      {/* Decorative sample card, clearly labelled as a sample */}
      <div className="relative" aria-hidden="true">
        <div className="max-w-[340px] rounded-2xl border border-white/15 bg-white/[0.08] p-5 backdrop-blur-md shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between text-[11px] text-white/60">
            <span>Sample preview</span>
            <span className="inline-flex items-center gap-1 text-[#9FE0BE]"><TrendingUp className="h-3 w-3" /> Today</span>
          </div>
          <div className="mt-3 flex items-end gap-1.5">
            {[38, 52, 44, 66, 58, 82, 74].map((h, i) => (
              <span key={i} className="flex-1 rounded-md bg-gradient-to-t from-[#2FA573]/60 to-[#9FE0BE]/90" style={{ height: `${h * 0.62}px` }} />
            ))}
          </div>
          <div className="mt-3 h-1.5 w-2/3 rounded-full bg-white/15" />
          <div className="mt-2 h-1.5 w-1/3 rounded-full bg-white/10" />
        </div>
      </div>
    </aside>
  );
}

export function AuthShell({ children, backTo = '/' }: { children: ReactNode; backTo?: '/' }) {
  return (
    <main className="min-h-[100dvh] w-full bg-[#FAFAF7] text-[#1F2A24] selection:bg-[#DCEBE1] selection:text-[#0F3D2E]">
      <div className="mx-auto grid min-h-[100dvh] max-w-[1400px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] gap-0 lg:gap-6 lg:p-5">
        <BrandPanel />

        <section className="relative flex min-h-[100dvh] flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 lg:min-h-0 lg:px-10">
          {/* Soft ambient wash behind the form (mobile + desktop) */}
          <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden" aria-hidden="true">
            <div className="absolute -top-40 left-1/2 h-[380px] w-[620px] -translate-x-1/2 rounded-full bg-[#0F3D2E]/[0.06] blur-[100px]" />
          </div>

          <header className="relative z-10 flex items-center justify-between">
            <Link
              to={backTo}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-[#1F2A24]/60 transition-colors hover:bg-[#0F3D2E]/5 hover:text-[#0F3D2E] focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to home
            </Link>
            <div className="lg:hidden"><BrandLockup /></div>
          </header>

          <div className="relative z-10 flex flex-1 items-center justify-center py-8">
            <div className="w-full max-w-[460px] rounded-3xl border border-[#E3EAE5] bg-white p-5 shadow-[0_1px_2px_rgba(15,61,46,0.04),0_24px_60px_-28px_rgba(15,61,46,0.25)] animate-in fade-in-50 slide-in-from-bottom-2 duration-500 min-[400px]:p-7 sm:p-9">
              {children}
            </div>
          </div>

          <footer className="relative z-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-[#1F2A24]/55">
            <span>© 2026 STORVA</span>
            <Link to="/terms" className="inline-flex min-h-[44px] items-center px-1 hover:text-[#0F3D2E] hover:underline">Terms of Service</Link>
            <Link to="/privacy" className="inline-flex min-h-[44px] items-center px-1 hover:text-[#0F3D2E] hover:underline">Privacy Policy</Link>
          </footer>
        </section>
      </div>
    </main>
  );
}
