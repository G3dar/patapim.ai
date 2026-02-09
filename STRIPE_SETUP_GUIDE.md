# Guía Completa: Setup de Stripe para PATAPIM

## Resumen del proyecto

PATAPIM (patapim.ai) es una app de escritorio para Windows con un website en Astro desplegado en Cloudflare Workers. Necesita Stripe para:

- **Pro Subscription**: $6.99/month con 14-day free trial
- **Lifetime Unlock**: $29.99 one-time payment (limited time)
- **Customer Portal**: Para que los usuarios cancelen/gestionen su suscripción

Stack técnico:
- Frontend: Astro 5.2 (actualmente `output: 'static'`, necesita cambiar a `'hybrid'`)
- Backend: Cloudflare Workers (via @astrojs/cloudflare adapter)
- Storage: Cloudflare KV (para licencias)
- Payments: Stripe SDK v17.5 (ya instalado en package.json)
- Dominio: patapim.ai

---

## PARTE 1: Configuración en el Dashboard de Stripe

### 1.1 Verificar cuenta y activar pagos

1. Ir a https://dashboard.stripe.com
2. Completar la verificación de la cuenta si no está hecha:
   - Settings → Business details → Completar todos los campos
   - Settings → Bank accounts and scheduling → Agregar cuenta bancaria para recibir pagos
3. Asegurarse de que la cuenta esté en modo **Test** primero (toggle arriba a la derecha dice "Test mode")

### 1.2 Configurar branding

1. Ir a Settings → Branding
2. Configurar:
   - **Business name**: `PATAPIM`
   - **Icon**: Subir un ícono cuadrado de PATAPIM (512x512 recomendado)
   - **Brand color**: `#d4a574` (el amber accent de PATAPIM)
   - **Accent color**: `#c9956a`
3. Ir a Settings → Customer portal
   - Activar "Allow customers to cancel subscriptions"
   - Activar "Allow customers to update payment methods"
   - Activar "Allow customers to view billing history"
   - Business name: `PATAPIM`
   - Link to Terms: `https://patapim.ai/terms` (crear después)
   - Link to Privacy: `https://patapim.ai/privacy` (crear después)
   - Save

### 1.3 Crear los productos y precios

#### Producto 1: PATAPIM Pro (suscripción mensual)

1. Ir a Products → + Add product
2. Configurar:
   - **Name**: `PATAPIM Pro`
   - **Description**: `Full access to all PATAPIM features. Unlimited terminals, unlimited dictation, remote access from anywhere, task management, GitHub integration, plugin marketplace.`
   - **Image**: Subir logo de PATAPIM
3. Pricing:
   - **Pricing model**: Standard pricing
   - **Price**: `$6.99`
   - **Billing period**: Monthly
   - **Currency**: USD
4. Habilitar free trial:
   - Esto se configura al crear la Checkout Session desde el código, no en el producto
5. Guardar → Anotar el **Price ID** (empieza con `price_...`)

#### Producto 2: PATAPIM Lifetime (one-time)

1. Ir a Products → + Add product
2. Configurar:
   - **Name**: `PATAPIM Lifetime`
   - **Description**: `One-time payment. All Pro features forever. No subscriptions, no renewals.`
   - **Image**: Subir logo de PATAPIM
3. Pricing:
   - **Pricing model**: Standard pricing
   - **Price**: `$29.99`
   - **Type**: One time
   - **Currency**: USD
4. Guardar → Anotar el **Price ID** (empieza con `price_...`)

### 1.4 Configurar el Customer Portal

1. Ir a Settings → Billing → Customer portal
2. Sección "Subscriptions":
   - Cancellation: Allow → prorate
   - Switching plans: No (solo hay 1 plan)
3. Payment methods: Allow update
4. Invoice history: Show
5. Save

### 1.5 Crear el Webhook endpoint

1. Ir a Developers → Webhooks → + Add endpoint
2. Configurar:
   - **Endpoint URL**: `https://patapim.ai/api/stripe/webhook`
   - **Description**: `PATAPIM license management`
   - **Events to listen to** (seleccionar estos):
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
3. Add endpoint → Anotar el **Webhook Signing Secret** (empieza con `whsec_...`)

### 1.6 Obtener las API Keys

1. Ir a Developers → API keys
2. Anotar:
   - **Publishable key**: `pk_test_...` (se usa en el frontend)
   - **Secret key**: `sk_test_...` (se usa en el backend, NUNCA exponer)

---

## PARTE 2: Configuración en Cloudflare

### 2.1 Crear KV Namespaces

Ejecutar estos comandos con Wrangler CLI:

```bash
# Namespace para licencias (producción)
wrangler kv namespace create LICENSES
# → Anotar el ID que devuelve

# Namespace para licencias (preview/development)
wrangler kv namespace create LICENSES --preview
# → Anotar el preview ID

# Namespace para feedback (producción)
wrangler kv namespace create FEEDBACK
# → Anotar el ID

# Namespace para feedback (preview/development)
wrangler kv namespace create FEEDBACK --preview
# → Anotar el preview ID
```

### 2.2 Configurar secrets en Cloudflare

```bash
# Stripe Secret Key
wrangler secret put STRIPE_SECRET_KEY
# → Pegar: sk_test_XXXXXXX (en test) o sk_live_XXXXXXX (en producción)

# Stripe Webhook Signing Secret
wrangler secret put STRIPE_WEBHOOK_SECRET
# → Pegar: whsec_XXXXXXX

# Stripe Price ID para Pro mensual
wrangler secret put STRIPE_PRICE_PRO_MONTHLY
# → Pegar: price_XXXXXXX

# Stripe Price ID para Lifetime
wrangler secret put STRIPE_PRICE_LIFETIME
# → Pegar: price_XXXXXXX
```

### 2.3 Actualizar wrangler.toml

```toml
name = "patapim-ai"
main = "dist/_worker.js"
compatibility_date = "2024-12-01"
account_id = "d5e2374c14ca5e3c166e84f47265f5cd"

routes = [
  { pattern = "patapim.ai/*", zone_name = "patapim.ai" },
  { pattern = "www.patapim.ai/*", zone_name = "patapim.ai" }
]

[assets]
directory = "./dist"

[vars]
SITE_URL = "https://patapim.ai"

[[kv_namespaces]]
binding = "LICENSES"
id = "TU_LICENSES_KV_ID_AQUI"
preview_id = "TU_LICENSES_PREVIEW_KV_ID_AQUI"

[[kv_namespaces]]
binding = "FEEDBACK"
id = "TU_FEEDBACK_KV_ID_AQUI"
preview_id = "TU_FEEDBACK_PREVIEW_KV_ID_AQUI"
```

---

## PARTE 3: Cambios en el código de PATAPIM.AI

### 3.1 Cambiar Astro a modo hybrid

**Archivo**: `astro.config.mjs`

Cambiar `output: 'static'` a `output: 'hybrid'`. Esto permite que las páginas sean estáticas por defecto pero que se puedan crear API routes dinámicas (server-side rendered).

```js
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://patapim.ai',
  output: 'hybrid',
  adapter: cloudflare(),
  build: {
    assets: '_assets'
  }
});
```

IMPORTANTE: Todas las páginas existentes (index, pricing, download, docs) deben mantener `export const prerender = true;` en su frontmatter para seguir siendo estáticas. Solo las API routes serán dinámicas.

### 3.2 Agregar `export const prerender = true` a todas las páginas estáticas

Agregar en el frontmatter de estos archivos:
- `src/pages/index.astro`
- `src/pages/pricing.astro`
- `src/pages/download.astro`
- `src/pages/docs/[...slug].astro`

```astro
---
export const prerender = true;
// ... resto del frontmatter
---
```

### 3.3 Crear API routes

Se necesitan crear estos 4 archivos de API:

#### `src/pages/api/stripe/checkout.ts`

Endpoint POST que crea una Stripe Checkout Session.

- Recibe: `{ plan: 'pro' | 'lifetime', email?: string }`
- Para `pro`: Crea session con `mode: 'subscription'`, `trial_period_days: 14`
- Para `lifetime`: Crea session con `mode: 'payment'`
- Ambos usan `success_url` y `cancel_url` con el dominio de PATAPIM
- Retorna: `{ url: 'https://checkout.stripe.com/...' }` (URL de Checkout)

Parámetros de la Checkout Session:
```
{
  mode: 'subscription' | 'payment',
  payment_method_types: ['card'],
  line_items: [{ price: PRICE_ID, quantity: 1 }],
  success_url: SITE_URL + '/download?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: SITE_URL + '/pricing',
  subscription_data: { trial_period_days: 14 },  // solo para pro
  allow_promotion_codes: true,
  client_reference_id: email || undefined,
  metadata: { plan: 'pro' | 'lifetime' }
}
```

#### `src/pages/api/stripe/webhook.ts`

Endpoint POST que recibe webhooks de Stripe.

- Verifica la firma del webhook con `stripe.webhooks.constructEvent()`
- Maneja estos eventos:
  - `checkout.session.completed`: Crea la licencia en KV
  - `customer.subscription.updated`: Actualiza estado de la licencia
  - `customer.subscription.deleted`: Marca licencia como expirada
  - `invoice.payment_failed`: Marca licencia como "payment_failed"

Estructura de la licencia en KV:
```json
{
  "email": "user@example.com",
  "plan": "pro" | "lifetime",
  "status": "active" | "trialing" | "past_due" | "canceled" | "expired",
  "stripeCustomerId": "cus_XXX",
  "stripeSubscriptionId": "sub_XXX",
  "createdAt": "2025-01-01T00:00:00Z",
  "expiresAt": "2025-02-01T00:00:00Z" | null,
  "licenseKey": "PTPM-XXXX-XXXX-XXXX"
}
```

Keys en KV:
- `license:{email}` → license object
- `customer:{stripeCustomerId}` → email (reverse lookup)
- `key:{licenseKey}` → email (reverse lookup)

#### `src/pages/api/stripe/portal.ts`

Endpoint POST que crea un Customer Portal session.

- Recibe: `{ email: string }` o `{ customerId: string }`
- Busca el customer en KV
- Crea portal session: `stripe.billingPortal.sessions.create({ customer, return_url })`
- Retorna: `{ url: 'https://billing.stripe.com/...' }`

#### `src/pages/api/license/verify.ts`

Endpoint POST que la app de escritorio llama para verificar una licencia.

- Recibe: `{ email: string, licenseKey: string }`
- Busca en KV por `key:{licenseKey}`
- Verifica que el email coincida y que el status sea `active` o `trialing`
- Retorna: `{ valid: true, plan: 'pro', expiresAt: '...' }` o `{ valid: false, reason: '...' }`

### 3.4 Conectar los botones de la pricing page

En `src/pages/pricing.astro`, agregar un script que maneje los clicks de checkout:

```html
<script>
  document.getElementById('checkout-monthly')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro' })
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
  });

  document.getElementById('checkout-lifetime')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'lifetime' })
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
  });
</script>
```

---

## PARTE 4: Generar License Keys

Formato de licencia: `PTPM-XXXX-XXXX-XXXX` (16 chars alfanuméricos agrupados).

Función de generación:
```ts
function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I,O,0,1 para evitar confusión
  const segments = [];
  for (let s = 0; s < 3; s++) {
    let seg = '';
    for (let i = 0; i < 4; i++) {
      seg += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(seg);
  }
  return 'PTPM-' + segments.join('-');
}
```

La licencia se genera en el webhook cuando `checkout.session.completed` llega. Se guarda en KV y se envía por email al usuario (o se muestra en la success page).

---

## PARTE 5: Flow completo del usuario

### Flujo de compra Pro:
1. Usuario clickea "Start Free Trial" en /pricing
2. Frontend hace POST a `/api/stripe/checkout` con `{ plan: 'pro' }`
3. Backend crea Stripe Checkout Session con `trial_period_days: 14`
4. Usuario es redirigido a Stripe Checkout → ingresa email y tarjeta
5. Stripe procesa → redirige a `/download?session_id=XXX`
6. Webhook `checkout.session.completed` llega al backend
7. Backend genera license key, guarda en KV
8. Usuario descarga PATAPIM, ingresa email + license key en la app
9. App llama a `/api/license/verify` para validar

### Flujo de compra Lifetime:
1. Usuario clickea "Get Lifetime Access" en /pricing
2. Frontend hace POST a `/api/stripe/checkout` con `{ plan: 'lifetime' }`
3. Backend crea Checkout Session con `mode: 'payment'`
4. Usuario es redirigido a Stripe Checkout
5. Stripe cobra $29.99 → redirige a `/download?session_id=XXX`
6. Webhook llega → backend crea licencia lifetime (sin expiresAt)

### Flujo de cancelación:
1. Usuario va a Settings en la app → "Manage Subscription"
2. App llama a `/api/stripe/portal` con su email
3. Se abre el Stripe Customer Portal en el browser
4. Usuario cancela → webhook `customer.subscription.deleted` llega
5. Backend marca licencia como `canceled` con `expiresAt` al fin del período
6. App chequea periódicamente `/api/license/verify` → eventualmente retorna `valid: false`

---

## PARTE 6: Testing

### 6.1 Tarjetas de prueba de Stripe

| Tarjeta | Resultado |
|---------|-----------|
| `4242 4242 4242 4242` | Pago exitoso |
| `4000 0000 0000 3220` | Requiere 3D Secure |
| `4000 0000 0000 0002` | Tarjeta rechazada |
| `4000 0000 0000 0341` | Falla al adjuntar a customer |

Usar cualquier fecha futura y cualquier CVC de 3 dígitos.

### 6.2 Testing local de webhooks

```bash
# Instalar Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forwarding de webhooks a local
stripe listen --forward-to localhost:4321/api/stripe/webhook

# En otra terminal
npm run dev
```

El Stripe CLI te da un webhook signing secret temporal (`whsec_...`) para usar en desarrollo.

### 6.3 Checklist de verificación

- [ ] Crear producto Pro en Stripe Dashboard → obtener Price ID
- [ ] Crear producto Lifetime en Stripe Dashboard → obtener Price ID
- [ ] Configurar Customer Portal en Stripe Dashboard
- [ ] Crear webhook endpoint en Stripe Dashboard → obtener Webhook Secret
- [ ] Obtener API keys (Publishable + Secret)
- [ ] Crear KV namespaces en Cloudflare (`wrangler kv namespace create`)
- [ ] Configurar secrets en Cloudflare (`wrangler secret put`)
- [ ] Actualizar `wrangler.toml` con KV namespace IDs
- [ ] Cambiar Astro a `output: 'hybrid'`
- [ ] Agregar `export const prerender = true` a páginas estáticas
- [ ] Crear `src/pages/api/stripe/checkout.ts`
- [ ] Crear `src/pages/api/stripe/webhook.ts`
- [ ] Crear `src/pages/api/stripe/portal.ts`
- [ ] Crear `src/pages/api/license/verify.ts`
- [ ] Conectar botones de checkout en pricing page
- [ ] Testear con tarjeta `4242...` en modo test
- [ ] Testear webhook con Stripe CLI local
- [ ] Verificar que licencia se crea en KV después de checkout
- [ ] Verificar que `/api/license/verify` funciona
- [ ] Verificar Customer Portal funciona
- [ ] Verificar cancelación actualiza la licencia
- [ ] Cambiar a modo Live en Stripe → actualizar API keys y webhook secret
- [ ] Re-crear webhook endpoint con URL de producción
- [ ] Desplegar a Cloudflare

---

## PARTE 7: Paso a Producción

Cuando todo funcione en test mode:

1. En Stripe Dashboard, desactivar "Test mode" (toggle arriba a la derecha)
2. Crear los mismos 2 productos en modo Live con los mismos precios
3. Crear nuevo webhook endpoint en modo Live apuntando a `https://patapim.ai/api/stripe/webhook`
4. Obtener nuevas API keys de producción
5. Actualizar los secrets en Cloudflare:
   ```bash
   wrangler secret put STRIPE_SECRET_KEY       # sk_live_XXX
   wrangler secret put STRIPE_WEBHOOK_SECRET   # whsec_XXX (del webhook live)
   wrangler secret put STRIPE_PRICE_PRO_MONTHLY # price_XXX (live)
   wrangler secret put STRIPE_PRICE_LIFETIME    # price_XXX (live)
   ```
6. Desplegar: `npm run build && wrangler deploy`
7. Hacer una compra de prueba real con una tarjeta propia (se puede reembolsar después)

---

## Resumen de Variables de Entorno / Secrets

| Variable | Dónde | Ejemplo |
|----------|-------|---------|
| `STRIPE_SECRET_KEY` | Cloudflare Secret | `sk_test_...` o `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Cloudflare Secret | `whsec_...` |
| `STRIPE_PRICE_PRO_MONTHLY` | Cloudflare Secret | `price_...` |
| `STRIPE_PRICE_LIFETIME` | Cloudflare Secret | `price_...` |
| `SITE_URL` | wrangler.toml [vars] | `https://patapim.ai` |
| `LICENSES` | KV Namespace binding | (en wrangler.toml) |
| `FEEDBACK` | KV Namespace binding | (en wrangler.toml) |

---

## Estructura de archivos final

```
src/pages/
  api/
    stripe/
      checkout.ts    ← Crea Checkout Sessions
      webhook.ts     ← Recibe webhooks de Stripe
      portal.ts      ← Crea Customer Portal sessions
    license/
      verify.ts      ← Verifica licencias (llamado por la app)
  index.astro        ← (agregar export const prerender = true)
  pricing.astro      ← (agregar export const prerender = true + checkout script)
  download.astro     ← (agregar export const prerender = true)
  docs/[...slug].astro ← (agregar export const prerender = true)
```
