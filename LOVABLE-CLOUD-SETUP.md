# Lovable Cloud setup applied to this project

These changes are already live in this project's database. Re-run them only when
moving STORVA to a new, empty backend (after the schema in `schema.legacy.sql`
and the migrations in `drizzle/migrations`).

## 1. Plans (current values — prices in paise)

```sql
INSERT INTO public.plans (id, name, price_monthly, price_yearly, product_limit, order_limit, storage_mb, ai_limit, trial_days, features, sort) VALUES
  ('free',   'Free',   0,     0,       25,   50,   100,   20,   0,  '["basic_ai"]'::jsonb, 0),
  ('growth', 'Growth', 24900, 298800,  100,  500,  1024,  200,  14, '["basic_ai","image_ai"]'::jsonb, 1),
  ('pro',    'Pro',    89900, 1078800, 1000, 5000, 10240, 1000, 14, '["basic_ai","image_ai","marketing_ai"]'::jsonb, 2)
ON CONFLICT (id) DO UPDATE SET name = excluded.name, price_monthly = excluded.price_monthly, price_yearly = excluded.price_yearly,
  product_limit = excluded.product_limit, order_limit = excluded.order_limit, storage_mb = excluded.storage_mb,
  ai_limit = excluded.ai_limit, trial_days = excluded.trial_days, features = excluded.features, sort = excluded.sort;
```

The `free` row must always exist: every new account is put on it by the sign-up trigger.
Migration `0013_seed_plans_and_single_signup_trigger.sql` now inserts these three rows (without overwriting existing ones) on a new database.

## 2. Product photo storage

- Private bucket `product-images`, 5 MB per file, images only.
- Each store owner can only read/upload/change/delete files inside a folder named after their own user id:

```sql
CREATE POLICY "merchant images read"   ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "merchant images insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "merchant images update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "merchant images delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
```

## 3. Hourly notification job

- Schedule `storva-notifications-hourly`, cron `5 * * * *` (once an hour, 24 runs a day),
  calling `POST <site>/api/public/jobs/notifications`.

## 4. Still needed from the owner

- Razorpay keys (online payments and paid plans)
- Email sending details
- WhatsApp Business details
