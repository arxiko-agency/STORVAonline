-- 0014: verified mobile number per account (mandatory OTP verification after sign-in).
--
-- The one-time code is sent and checked by the authentication backend (phone change flow). When it succeeds the backend
-- stores the number in auth.users (phone + phone_confirmed_at). This migration copies that confirmed number into the
-- merchant's profile so the app can show it, and makes sure the browser can never write these two columns itself.
-- Safe to re-run.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mobile_verified_at timestamptz;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_mobile_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_mobile_format
  CHECK (mobile IS NULL OR mobile ~ '^\+[1-9][0-9]{6,14}$');

-- One account per mobile number (the auth backend enforces the same on auth.users.phone).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_mobile_key ON public.profiles (mobile) WHERE mobile IS NOT NULL;

-- Copy the confirmed number from auth.users into the profile; clear it if the number is ever removed.
CREATE OR REPLACE FUNCTION public.sync_profile_mobile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone <> '' AND NEW.phone_confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
       SET mobile = '+' || ltrim(NEW.phone, '+'), mobile_verified_at = NEW.phone_confirmed_at
     WHERE id = NEW.id;
  ELSE
    UPDATE public.profiles SET mobile = NULL, mobile_verified_at = NULL WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.sync_profile_mobile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_phone_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_phone_confirmed
  AFTER UPDATE OF phone, phone_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.phone IS DISTINCT FROM NEW.phone OR OLD.phone_confirmed_at IS DISTINCT FROM NEW.phone_confirmed_at)
  EXECUTE FUNCTION public.sync_profile_mobile();

-- Accounts that already have a confirmed number.
UPDATE public.profiles p
   SET mobile = '+' || ltrim(u.phone, '+'), mobile_verified_at = u.phone_confirmed_at
  FROM auth.users u
 WHERE u.id = p.id AND u.phone IS NOT NULL AND u.phone <> '' AND u.phone_confirmed_at IS NOT NULL;

-- The "own profile update" policy lets a signed-in user update any column of their own row. Without this guard a user
-- could mark themselves verified. Only the trigger above (runs as the table owner) may change these two columns.
CREATE OR REPLACE FUNCTION public.profiles_protect_mobile()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (NEW.mobile IS DISTINCT FROM OLD.mobile OR NEW.mobile_verified_at IS DISTINCT FROM OLD.mobile_verified_at) THEN
    RAISE EXCEPTION 'The mobile number can only be changed by verifying it with a one-time code.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS profiles_protect_mobile ON public.profiles;
CREATE TRIGGER profiles_protect_mobile
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_protect_mobile();
