# STORVA Database Migration Guide: MongoDB to Supabase

This document provides a comprehensive, production-ready blueprint for safely migrating data from the legacy STORVA Express + MongoDB architecture into the modern Supabase PostgreSQL backend.

---

## 1. Architectural Overview & Coexistence Strategy

STORVA currently maintains two clean, non-conflicting backend architectures:
1. **Active Platform Backend:** Supabase PostgreSQL with SSR (via Nitro / Vite), Row-Level Security (RLS), and Postgres RPC functions.
2. **Legacy Backend (`legacy/STORVA-express/`):** Self-contained Node.js Express backend with Mongoose ODM and MongoDB.

### Coexistence Principle
- **No mixed authentication:** The active frontend uses Supabase Auth (`@supabase/supabase-js`) exclusively.
- **Zero data destruction:** The migration is non-destructive. Running the migration does not delete, mutate, or drop any data in the legacy MongoDB database or Supabase.
- **Idempotency:** Every entity operation uses upserts or conflict keys, meaning the migration script can be run multiple times safely without producing duplicate rows.

---

## 2. Entity Mapping Matrix

| Legacy MongoDB Collection | Supabase PostgreSQL Target | Mapping Logic & Key Transformations |
| :--- | :--- | :--- |
| `users` | `auth.users` & `public.profiles` | Email, password verification status, full name. Maps `user._id` to Supabase user ID and stores `legacy_mongo_id` in metadata. |
| `stores` | `public.profiles`, `public.store_commerce_settings`, `public.notification_preferences` | • `name` & `slug` map to `profiles.store_name` and `profiles.store_slug`.<br>• `taxSettings` & `shippingSettings` map to `store_commerce_settings` (GST rates, GSTIN, flat rate, COD rules, regional overrides).<br>• `notifications` map to `notification_preferences`. |
| `storedesigns` | `public.store_themes` & `public.theme_versions` | Converts theme preset, color palette, fonts, header announcement, sections, and footer into the modern STORVA designer schema. |
| `products` | `public.products` | Converts `pricePaise` / 100 to rupees `price`. Converts `compareAtPricePaise` / 100 to `compare_at_price`. Maps `hsn` to `hsn_code`, `gstRate` to `gst_rate`, and primary image URL to `image_path`. |
| `customers` | `public.customers` | Maps phone, name, email, delivery address, `orderCount`, `totalSpentPaise` / 100 to `total_spent`, `codBlocked` to `cod_blocked`, tags, and notes. Unique on `(owner_id, phone)`. |
| `orders` | `public.orders` | Preserves `order_number`, customer details, shipping address, notes, dates, and order status (`pending`, `confirmed`, `packed`, `shipped`, `delivered`, `cancelled`). Converts paise values to rupees (`subtotal`, `shipping_fee`, `cod_fee`, `tax_total`, `cgst`, `sgst`, `igst`, `total`). |
| `orders.items` | `public.order_items` | Extracts snapshots: title, quantity, unit price, line total, HSN code, GST rate, taxable value, and tax amount. |
| `subscriptions` | `public.subscriptions` | Maps plans (`free`, `growth`, `pro`, `enterprise`), Razorpay subscription IDs, billing intervals, and period dates. |

---

## 3. Pre-Migration Prerequisites

1. **Database Schema:** Ensure Supabase migrations have been applied:
   - `drizzle/migrations/0000_restore_plans_and_signup_hook.sql`
   - `drizzle/migrations/0001_plans_public_flag_and_column_access.sql`
   - `drizzle/migrations/0002_four_plans_complete.sql`
   - `drizzle/migrations/0003_complete_schema_and_rpc.sql`
2. **Node.js Environment:** Node.js v18+ with `@supabase/supabase-js` and `mongodb` installed.
3. **Credentials:**
   - Source MongoDB URI: `MONGODB_URI`
   - Target Supabase: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

---

## 4. Execution Procedures

### Step 1: Dry-Run Simulation (Recommended First Step)
To test connectivity and data mapping without writing to Supabase:

```bash
# Using live MongoDB connection
node scripts/migrate-mongo-to-supabase.mjs --dry-run --mongo-uri="mongodb://localhost:27017/storva"

# Or using exported JSON collections
node scripts/migrate-mongo-to-supabase.mjs --dry-run --json-dir="./dumps"
```

Review the output audit summary to confirm counts for users, stores, products, orders, and customers.

### Step 2: Live Migration Execution
Once the dry-run passes with zero errors:

```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export MONGODB_URI="mongodb://localhost:27017/storva"

# Execute live migration
node scripts/migrate-mongo-to-supabase.mjs
```

### Alternative: Offline Migration via JSON Dumps
If the MongoDB database is hosted behind a firewall or in an isolated network:
1. Export collections from MongoDB:
   ```bash
   mongoexport --db storva --collection users --out ./dumps/users.json
   mongoexport --db storva --collection stores --out ./dumps/stores.json
   mongoexport --db storva --collection products --out ./dumps/products.json
   mongoexport --db storva --collection customers --out ./dumps/customers.json
   mongoexport --db storva --collection orders --out ./dumps/orders.json
   mongoexport --db storva --collection storedesigns --out ./dumps/storedesigns.json
   mongoexport --db storva --collection subscriptions --out ./dumps/subscriptions.json
   ```
2. Run migration using the dump directory:
   ```bash
   node scripts/migrate-mongo-to-supabase.mjs --json-dir=./dumps
   ```

---

## 5. Post-Migration Verification

Run the verification checklist:
1. **Users & Auth:** Verify in Supabase Studio (`Authentication -> Users`) that users exist and can sign in.
2. **Catalog:** Sign in as a migrated store owner and check `/products` to verify titles, prices, stock, HSN, and GST rates.
3. **Orders & Invoices:** Verify that `/orders` displays historical orders with full totals, line items, and delivery status.
4. **Store Designer:** Check `/theme` to verify the migrated theme layout, banner, and typography.
5. **Shipping & GST:** Check `/settings` to verify GSTIN, legal name, tax rules, and delivery flat rates.

---

## 6. Rollback & Reversibility Strategy

Because the migration is non-destructive:
- **MongoDB Remains Pristine:** No delete or update operations are executed against the MongoDB source database.
- **Rollback in Supabase:** If a migration run needs to be completely reset:
  ```sql
  -- Delete migrated data scoped by legacy metadata tag
  DELETE FROM auth.users WHERE raw_user_meta_data->>'legacy_mongo_id' IS NOT NULL;
  -- Cascading foreign keys will clean up profiles, store_commerce_settings, products, orders, and themes.
  ```
- **Selective Re-run:** Because all insertions check for existing records by unique identifiers (email, phone, store slug, order number), the script can be rerun at any time to catch up on new records without corrupting existing rows.
