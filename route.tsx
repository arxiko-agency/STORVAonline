import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { loginRedirectFor } from '@/lib/auth-guard';
import { isMobileVerified } from '@/lib/mobile-verification';
import { safeRedirect } from '@/lib/auth-redirect';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const [{ data: sessionData }, { data: userData }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);
    const target = loginRedirectFor({ hadSession: !!sessionData.session, user: userData.user, href: location.href });
    if (target) throw redirect({ to: '/login', search: target });
    // Signed in, but no mobile number confirmed by a one-time code yet: the dashboard stays closed until it is.
    if (!isMobileVerified(userData.user)) {
      throw redirect({ to: '/verify-mobile', search: { redirect: safeRedirect(location.href) } });
    }
  },
  component: () => <Outlet />,
});
