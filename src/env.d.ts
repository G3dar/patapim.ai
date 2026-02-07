/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_PRO_MONTHLY: string;
  STRIPE_PRICE_LIFETIME: string;
  SITE_URL: string;
  LICENSES: KVNamespace;
  FEEDBACK: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSIONS: KVNamespace;
}

declare namespace App {
  interface Locals extends Runtime {}
}
