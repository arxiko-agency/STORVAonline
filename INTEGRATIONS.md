# STORVA Integrations & External Services Guide

This document details all third-party integrations, external service connectors, authentication mechanisms, and testing requirements in STORVA.

---

## 1. Integrations Status Matrix

| Integration | Required Credentials | Purpose & Features Covered | Health / Status Endpoint | Credential Status |
| :--- | :--- | :--- | :--- | :--- |
| **Supabase** | `SUPABASE_URL`<br>`SUPABASE_PUBLISHABLE_KEY`<br>`SUPABASE_SERVICE_ROLE_KEY` | • Auth & multi-tenant isolation<br>• Database operations & RLS<br>• Private image storage (`product-images`)<br>• Realtime updates | `GET /api/public/health` (`checks.database`) | Ready / Active architecture |
| **Razorpay** | `RAZORPAY_KEY_ID`<br>`RAZORPAY_KEY_SECRET`<br>`RAZORPAY_WEBHOOK_SECRET` | • Merchant subscription plans (Free, Growth, Pro, Enterprise)<br>• Monthly / Yearly auto-renewals<br>• HMAC-SHA256 webhook verification (`/api/public/razorpay-webhook`)<br>• Invoice URL generation | `GET /api/public/health` (`checks.payments`, `checks.paymentWebhook`) | Configured in code; Requires merchant Razorpay keys |
| **Shiprocket** | `SHIPROCKET_EMAIL`<br>`SHIPROCKET_PASSWORD`<br>`SHIPROCKET_TOKEN` (optional) | • Automatic order creation & shipment generation<br>• AWB code and courier assignment<br>• Live tracking URL generation (`/tracking/<awb>`)<br>• Delivery status sync with order transitions | `GET /api/public/health` (`checks.shiprocket`) | Implemented in `src/lib/shiprocket.server.ts`; Requires Shiprocket login |
| **WhatsApp Business API** | `WHATSAPP_API_KEY`<br>`WHATSAPP_PHONE_NUMBER_ID` | • WhatsApp Business catalogue synchronization<br>• 24-hr session chat & message template sending<br>• Webhook verification & incoming event deduplication (`/api/public/whatsapp/webhook`)<br>• Customer order status updates | `GET /api/public/health` (`checks.whatsapp`) | Implemented in `src/lib/whatsapp.server.ts`; Requires WhatsApp API key |
| **Gmail / SMTP** | `GOOGLE_MAIL_API_KEY` or `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | • Store owner instant new order email alerts<br>• Customer order confirmation & tracking update emails<br>• Low-stock warning emails<br>• Daily store performance summaries | `GET /api/public/health` (`checks.email`) | Implemented in `src/lib/gmail.server.ts` & `src/lib/order-alert.server.ts`; Requires Gmail/SMTP credentials |
| **Lovable AI Gateway** | `LOVABLE_API_KEY`<br>`LOVABLE_CRON_SECRET` | • 8 AI Studio tools (Malayalam/English titles, descriptions, SEO, categorization, pricing suggestions, photo feature extraction, marketing, social captions)<br>• Hourly notification queue runner (`/api/public/jobs/notifications`) | `GET /api/public/health` (`checks.ai`) | Implemented in `src/lib/ai.server.ts`; Requires Lovable AI gateway key |
| **Legacy MongoDB Backend** | `MONGODB_URI` | • Express + MongoDB architecture preservation<br>• Standalone migration engine (`scripts/migrate-mongo-to-supabase.mjs`) | Standalone Express test suite in `legacy/` | Preserved untouched in `legacy/STORVA-express/` |

---

## 2. Testing & Verification Procedures

### 1. Health Check Probe
Anyone or an uptime monitoring service can query the health endpoint:
```bash
curl -s http://localhost:3000/api/public/health | jq .
```
Response format:
```json
{
  "status": "ok",
  "checks": {
    "database": true,
    "ai": false,
    "email": false,
    "whatsapp": false,
    "payments": false,
    "paymentWebhook": false,
    "shiprocket": false
  },
  "ms": 12
}
```
Each check returns `true` when the corresponding secret is configured and valid, or `false` when running in unconfigured development mode.

### 2. Testing Payment Webhook Locally
You can test the Razorpay webhook with HMAC-SHA256 signature verification using the Vitest suite:
```bash
npm test src/routes/api/public/-razorpay-webhook.test.ts
```

### 3. Testing Shiprocket Integration
You can test the Shiprocket authentication, order creation, courier assignment, and tracking sync using:
```bash
npm test src/lib/shiprocket.test.ts
```

### 4. Testing WhatsApp Catalogue Sync
You can verify the WhatsApp catalogue synchronization and product payload formatting using:
```bash
npm test src/test/whatsapp-catalog.test.ts
```

---

## 3. Security & Safe Handling Rules

1. **Never Commit Secrets:** Real keys (`RAZORPAY_KEY_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SHIPROCKET_PASSWORD`, `GOOGLE_MAIL_API_KEY`) must never be hardcoded into frontend files or committed to Git.
2. **Client vs Server Boundary:** Client code can only read `VITE_*` environment variables. All payment secrets, webhook secrets, and database service keys are restricted to SSR handlers (`src/lib/*.server.ts` and `src/routes/api/public/`).
3. **No Fake Success:** Payments, shipping labels, and notifications strictly validate credentials and return friendly, descriptive errors when unconfigured rather than faking successful transactions.
