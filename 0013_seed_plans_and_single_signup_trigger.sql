-- 0013: make a brand-new database usable for sign-up. Safe to re-run; changes nothing that already exists.
--
-- Fresh-database order: database/schema.legacy.sql -> drizzle/migrations 0000..0013.
--
-- 1) The plans table was created empty. Every new account is put on the "free" plan by the sign-up trigger
--    (subscriptions.plan_id has a foreign key to plans.id), so without these rows sign-up fails.
--    Values are the ones already live (database/LOVABLE-CLOUD-SETUP.md). DO NOTHING: an existing
--    production database keeps whatever prices/limits it has.
-- 2) is_public exists in the generated types but not in schema.legacy.sql.
-- 3) schema.legacy.sql installs on_auth_user_created_profile and 0008 installs on_auth_user_created; both run
--    handle_new_user(), whose profiles insert has no ON CONFLICT, so the second run fails every sign-up.
--    Keep 0008's trigger (it also creates the subscription) and drop the duplicate. No-op if it is absent.

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

INSERT INTO public.plans (id, name, price_monthly, price_yearly, product_limit, order_limit, storage_mb, ai_limit, trial_days, features, sort) VALUES
  ('free',   'Free',   0,     0,       25,   50,   100,   20,   0,  '["basic_ai"]'::jsonb, 0),
  ('growth', 'Growth', 24900, 298800,  100,  500,  1024,  200,  14, '["basic_ai","image_ai"]'::jsonb, 1),
  ('pro',    'Pro',    89900, 1078800, 1000, 5000, 10240, 1000, 14, '["basic_ai","image_ai","marketing_ai"]'::jsonb, 2)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

-- 4) The private product-images bucket was only described in the docs, never created by a migration, so on a new
--    database every photo upload (products and the store designer) fails. Same settings as the live bucket
--    (private, 5 MB, images). The owner-folder policies already exist in 0009.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', false, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Accounts created before the free plan existed get their missing subscription row.
INSERT INTO public.subscriptions (owner_id, plan_id, billing_interval, status)
SELECT u.id, 'free', 'monthly', 'free' FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.owner_id = u.id)
ON CONFLICT (owner_id) DO NOTHING;
