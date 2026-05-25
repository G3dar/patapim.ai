# patapim.ai (backend) — Hallazgos de seguridad

**Fecha:** 2026-05-23
**Repo:** `g3dar/patapim.ai` (Cloudflare Workers + Astro)
**Método:** auditoría de autorización/IDOR (lectura de código) + Semgrep
**Relacionado:** `../patapim/SECURITY_PLAN_B2B.md` (§4 backend)

> **Contexto:** el backend es el trust anchor del producto. La app de escritorio ya está bien endurecida; **acá están los agujeros reales.** Varios son rutas de takeover **sin autenticación**.

---

## ✅ Lo que está BIEN (para no romperlo)

- **`/api/device/*` — sin IDOR.** Todos derivan `googleId` de la sesión o del device token (el secreto), nunca de un id provisto por el cliente. Scoping correcto (`devices:${googleId}`, `apikeys:${googleId}`, etc.), con ownership checks en `rename`/`unlink`.
- **`/api/admin/*` — bien gateado.** Los 14 endpoints llaman `requireAdmin()` (sesión → `email === 'g@3dar.com'`). `update-plan` hasta tiene audit log. **Sin privilege escalation.**
- **Webhooks firmados:** Stripe (`constructEventAsync` con `STRIPE_WEBHOOK_SECRET`) y Telegram (`X-Telegram-Bot-Api-Secret-Token`) verifican firma.
- **OAuth `state`** validado y single-use; **reset/verify tokens** con 32 bytes CSPRNG + TTL + single-use; anti-enumeración en password reset; **CORS** con allowlist (sin wildcard).
- El flujo `connect-token` → `verify-connect` está bien hecho (one-time, TTL 5min, bound a googleId + deviceToken).

---

## 🔴 CRITICAL

### BE-1 — `stripe/portal.ts`: portal de facturación accesible sin auth (IDOR confirmado)
`src/pages/api/stripe/portal.ts:12-49` — **sin autenticación.** Toma `{email, customerId}` del body; si pasás `email`, busca `license:${email}` → `stripeCustomerId` y crea una billing portal session de Stripe.

```
POST /api/stripe/portal  {"email":"victima@x.com"}
→ { "url": "https://billing.stripe.com/...session_para_la_victima" }
```

**Impacto:** cualquiera, sabiendo solo el email de un cliente, accede a su portal de Stripe: ver facturas, dirección de facturación, últimos 4 de la tarjeta, **cancelar/cambiar la suscripción**. Brecha de privacidad + financiera directa sobre clientes. **Confirmado explotable.**

**Fix:** derivar `customerId` de la sesión autenticada (`getUserFromRequest`); ignorar `email`/`customerId` del cliente. Requerir login.

---

## 🟠 HIGH

### BE-2 — `license/redeem.ts`: robo de licencia sin auth (confirmado, dado un key)
`src/pages/api/license/redeem.ts:14-147` — **sin autenticación** (solo CORS). Con `{email, licenseKey}` válido, **re-asocia la licencia al email del atacante** (`license:${email}`, `key:${licenseKey}` → atacante) y marca la original como `transferred` → **deja afuera al dueño legítimo**.

**Cadena de ataque:** las license keys se filtran por rutas sin auth (BE-4 `session-info`, BE-5 `referral/status`) → con un key robado, `redeem` roba la licencia.

**Fix:** requerir sesión autenticada; el email destino debe ser el de la sesión, no del body. Loguear/alertar transferencias.

### BE-3 — Pairing: brute-force de device token (sin rate limit + RNG débil)
- `device/pair-code.ts:13` usa **`Math.random()`** (no CSPRNG) para el código de 6 chars (~30 bits). *(Generar el código sí requiere auth — OK.)*
- `device/pair-exchange.ts:8-48` — **sin auth y sin rate limit.** Acepta `{code, deviceName, machineId}`; si el código existe, **mintea un device token bound al googleId de la víctima** → control del device/cuenta.
- `device/poll-pairing.ts` — sin auth ni rate limit.

**Impacto:** un atacante brute-forcea `pair-exchange` con códigos al azar; si pega uno vivo (ventana de 10min de una víctima), obtiene un device token de la víctima.

**Fix:** CSPRNG (`crypto.getRandomValues`) para el código; **rate limit** en `pair-exchange`/`poll-pairing` (ya existe `rateLimit` en `lib/`, usarlo); bajar TTL; lockout por IP/código.

---

## 🟡 MEDIUM

| ID | Archivo | Issue | Fix |
|----|---------|-------|-----|
| BE-4 | `stripe/session-info.ts:40-46` | Sin auth; devuelve `email` + **`licenseKey`** para un `cs_...` id (los `cs_` aparecen en success URLs/historial/referrer) | Requerir auth o no devolver el licenseKey |
| BE-5 | `referral/status.ts:30-65` | Sin auth; filtra datos de referral + **`licenseKey`** de recompensa por email | Requerir auth; no devolver keys |
| BE-6 | `license/extend-trial.ts` | Sin auth; email no verificado → trials gratis o **griefing** (consume la extensión one-time de una víctima) | Requerir auth; verificar email |
| BE-7 | `telegram/instance/[id].ts` + DO `handleUpgrade` | WebSocket sin auth más allá de conocer el UUID (capability URL); permite `request_pairing`/`send_message` | Auth/ownership en el upgrade; no confiar solo en el secreto del UUID |
| BE-8 | `referral/invite.ts`, `referral/claim.ts` | Sin auth → fraude/spam de referidos | Requerir auth |

---

## 🟢 LOW

- `bugreport.ts`: sin auth, email spoofeable → spam de KV.
- `auth.ts:187`: PBKDF2 100k iteraciones (< OWASP 600k; limitación de Workers).
- `stripe/webhook.ts`: sin idempotencia por event-id (replay de evento firmado válido).

---

## 🧱 Bloqueante arquitectónico para B2B multi-tenant

**No existe modelo de tenant/org.** Admin = un email hardcodeado (`g@3dar.com`, `admin.ts:7`); **toda la data es global** en KV keyed por `googleId`/`email`. No hay orgs, ni roles, ni aislamiento por departamento.

El objetivo B2B (multi-tenant, customización per-usuario/depto) requiere **rediseñar el modelo de datos y autorización**:
- Entidades `org` → `department` → `user` con roles (org-admin, dept-admin, user).
- Todo acceso a KV/R2/DO scopeado por `orgId` (+ `userId`).
- Admin por-org en vez del email único.
- Esto es trabajo de Fase 3 del plan, no un fix puntual.

---

## Estado de remediación

- ✅ **BE-1 `stripe/portal`** — FIXED. Ahora exige sesión autenticada (`getUserFromRequest`) y deriva el `stripeCustomerId` de los registros del usuario logueado; ignora `email`/`customerId` del body. Caller legítimo (web `go.astro`, same-origin con cookie) sigue funcionando.
- ✅ **BE-2 `license/redeem`** — FIXED (requiere deploy coordinado). Ahora exige auth (`getUserFromRequestOrDeviceToken`) y bindea la licencia al email del usuario autenticado; ignora el `email` del body. **App actualizada** (`patapim/src/main/licenseManager.js`) para mandar `Authorization: Bearer <deviceToken>`. ⚠️ **Deploy:** versiones viejas de la app (sin el header) recibirán 401 en redeem hasta actualizar → deployar el backend junto con/después del release de la app. Cierre total del robo de keys depende también de BE-4/BE-5 (cortar la filtración de keys).
- ✅ **BE-3 pairing** — FIXED. `pair-code` usa CSPRNG (`crypto.getRandomValues`, sin sesgo de módulo); `pair-exchange` tiene rate limit por IP (10/10min, 429). `poll-pairing` se dejó sin rate limit (lo poolea la app legítimamente; su seguridad depende del `sessionId` impredecible).
- ✅ **BE-4 `stripe/session-info`** — FIXED (backend-only, sin cambio de caller). La `licenseKey` solo se devuelve para sesiones de Stripe **recientes** (<1h) y no-`unpaid`; en replay posterior se devuelve status/plan pero `licenseKey: null` + `keyWithheld`. La página `success.astro` (la llama segundos post-compra) sigue funcionando. Cierra el vector de fuga de keys que alimentaba el robo vía `redeem` (BE-2).
- ✅ **BE-6 `extend-trial`** — FIXED (sin riesgo de caller). Confirmado **sin caller** en ningún repo, así que exigir auth no rompe nada: ahora pide auth (`getUserFromRequestOrDeviceToken`) y bindea el trial al email autenticado; ignora el `email` del body. Cierra el "regalar/grifear trials a cualquier email".
- ⏳ **BE-5 `referral/status`** + **BE-8 `referral/invite`/`claim`** — DIFERIDOS. El fix correcto exige rutear las llamadas del **renderer** por el main/IPC con device token (`getAccount()` strippea el token a propósito; no lo expongo al renderer). Eso toca `src/shared/ipcChannels.js`, que **tiene cambios concurrentes activos** de otra sesión → mejor hacerlo como cambio propio y revisado cuando ese trabajo se asiente. Severidad media (fuga de key de recompensa de referido) / baja (fraude de referidos).
- ⏳ **BE-7 Telegram WS** (`instance/[id]` + DO `handleUpgrade`) — DIFERIDO. Auth/ownership a nivel Durable Object; necesita diseño, no es one-liner.
- ⏳ LOW + modelo multi-tenant: pendientes.

## Orden de remediación sugerido

1. **BE-1 `stripe/portal`** (auth + derivar customerId de sesión) — crítico, fix chico.
2. **BE-2 `license/redeem`** (auth + email = sesión) — alto, fix chico.
3. **BE-3 pairing** (CSPRNG + rate limit en pair-exchange/poll) — alto, fix chico.
4. **BE-4/5/6/8** (agregar auth a session-info, referral/status, extend-trial, referral/*) — medianos, fixes chicos.
5. **BE-7** (auth en el WS de telegram instance).
6. **Modelo multi-tenant** (Fase 3, arquitectónico).

> Casi todos los CRITICAL/HIGH son **"falta `getUserFromRequest()` + scopear al usuario de la sesión"** — patrón repetido en endpoints que hoy confían en datos del cliente. Fixes individualmente chicos, impacto grande.

---

## Ronda 2 (2026-05-23) — inyección / SSRF / auth-flow / DoS / Telegram DO

> Otra lente, distinta al sweep de IDOR (BE-1..8). Hallazgos nuevos.

### 🔴 CRITICAL
- **N-1 — Telegram Durable Object: takeover de instancia sin auth.** `durable-objects/TelegramInstance.ts:106-115` + `pages/api/telegram/instance/[id].ts:42`. El upgrade del WebSocket no tiene auth de ownership — solo conocer el UUID de la instancia; el primer connect bindea `instance_id`. Quien filtre/obtenga el UUID puede `request_pairing`/`send_message`/`claim_active` → control del relay de Telegram de esa cuenta. (Profundiza BE-7.) UUID v4 = 122 bits (no adivinable); el riesgo es **filtración**. Fix: atar el WS a un device-token/owner autenticado.
- **N-2 — `transcribe_voice` sin auth → abuso de Workers AI + DoS de memoria.** `TelegramInstance.ts:276-289`. Cualquier peer del WS (sin pairing) manda `transcribe_voice` con base64 arbitrario: sin cap de tamaño, sin rate limit; `[...bytes]` infla el buffer en un array gigante. Quema cuota/billing de Workers AI + CPU/mem. Fix: cap de tamaño + requerir `chat_id` paired + rate limit.

### 🟠 HIGH
- **N-3 — OAuth `state` no atado al browser → login-CSRF / session fixation.** `auth/google.ts:9-18` + `auth/callback.ts:40-44`. El `state` va a KV global sin cookie en el browser iniciador; el callback solo valida que exista. Un atacante puede hacer que la víctima quede logueada en la cuenta del atacante. Fix: cookie HttpOnly con el `state` (o su hash) + validar match en el callback.
- **N-4 — Stripe webhook sin idempotencia → replay rota la license key.** `stripe/webhook.ts:46-126`. Firma OK, pero sin dedupe por `event.id`. Un redelivery (Stripe reintenta en 5xx) re-ejecuta el bloque → `generateLicenseKey()` de nuevo sobreescribe `license:${email}`/`key:${licenseKey}` con un key NUEVO → invalida el viejo y deja afuera al dueño (la app falla `license/verify`). Fix: dedupe `stripe-evt:${event.id}` con TTL antes de procesar.

### 🟡 MEDIUM
- **N-6 — `extend-trial`: `machineId` sin sanitizar en keys de KV.** `license/extend-trial.ts` (`machine:${machineId}`, `trial:${machineId}`). Ya pusimos auth (BE-6), pero `machineId` del body sigue sin validar → `machineId = "victima@x.com"` escribe `trial:victima@x.com` (key-injection cross-namespace). Fix: validar charset/longitud o hashear.
- **N-7 — SSRF oracle vía `tunnelUrl`.** `device/debug.ts:42` + `device/list.ts:51` hacen `fetch(d.tunnelUrl + '/ping')`; `heartbeat.ts:48` lo setea sin validar. Un token holder apunta a URLs internas y lee `ok`/latencia/error. Fix: validar `tunnelUrl` https + dominio de tunnel allowlisted en heartbeat.

### LOW
- N-5 `request-email-verify` sin rate-limit por cuenta (self-targeted). N-8 `mkt/push` (admin-gated). Email templates: `name` sin escapar (self-inbox). `esc()` en admin.astro no escapa `'`.

### ✅ Verificado SÓLIDO (no romper)
PBKDF2 + salt + compare constante; tokens reset/verify (CSPRNG, TTL, single-use); change-password rota sesiones; account-linking sin confusión explotable; `assertSameOrigin`+SameSite consistente; firmas de webhooks (Stripe + Telegram); `returnTo` sin open-redirect; DO `edit_message_*` pinneado al chat paired; **v2/connect (path actual de la app) autenticado y owner-scoped por email**.

### Estado de remediación (Ronda 2)
- ✅ **N-1 — FIXED.** `instance/[id].ts` (legacy v1) ahora exige device token válido + bindea el UUID al owner email (TOFU); otra cuenta no puede engancharse a una instancia ajena. La app actual usa el path v2 autenticado; clientes v1 remanentes ya mandan el Bearer token, así que no se rompe nada.
- ✅ **N-2 — FIXED.** Cap de tamaño (10 MB b64) en `transcribe_voice` de **ambos** DOs (`TelegramInstance` + `TelegramAccount`) → frena el OOM por `[...bytes]` y el abuso de Workers AI. Combinado con N-1, el path legacy ya no es invocable anónimamente. *(Mejora futura: rate-limit por instancia.)*
- ⏳ N-3 (OAuth state cookie), N-4 (Stripe idempotency), N-6 (machineId), N-7 (tunnelUrl SSRF): pendientes.
