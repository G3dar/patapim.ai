import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin';

export const prerender = false;

interface OllamaConfig {
  version: 1;
  host: string;
  port: number;
  protocol: 'http' | 'https';
  publicUrl: string;
  defaultModel: string;
  enabled: boolean;
  updatedAt: string;
  createdAt: string;
  updatedFromInstance: string | null;
}

const DEFAULT_CONFIG: OllamaConfig = {
  version: 1,
  host: 'localhost',
  port: 11434,
  protocol: 'http',
  publicUrl: '',
  defaultModel: 'qwen2.5:7b',
  enabled: false,
  updatedAt: '',
  createdAt: '',
  updatedFromInstance: null,
};

export const GET: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  const googleId = auth.user.googleId;
  const raw = await env.LICENSES.get(`ollamaConfig:${googleId}`);
  const cfg: OllamaConfig = raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;

  return new Response(JSON.stringify(cfg), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const auth = await requireAdmin(env.SESSIONS, context.request);
  if ('response' in auth) return auth.response;

  const googleId = auth.user.googleId;

  let body: Partial<OllamaConfig> = {};
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const host = typeof body.host === 'string' ? body.host.trim() : 'localhost';
  const port = Number.isFinite(body.port) ? Math.max(1, Math.min(65535, body.port as number)) : 11434;
  const protocol = body.protocol === 'https' ? 'https' : 'http';
  const publicUrl = typeof body.publicUrl === 'string' ? body.publicUrl.trim() : '';
  const defaultModel = typeof body.defaultModel === 'string' ? body.defaultModel.trim() : 'qwen2.5:7b';
  const enabled = !!body.enabled;

  if (host.length > 253 || defaultModel.length > 200 || publicUrl.length > 500) {
    return new Response(JSON.stringify({ error: 'Field too long' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (publicUrl && !/^https?:\/\//.test(publicUrl)) {
    return new Response(JSON.stringify({ error: 'publicUrl must start with http:// or https://' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = new Date().toISOString();
  const existingRaw = await env.LICENSES.get(`ollamaConfig:${googleId}`);
  const existing = existingRaw ? JSON.parse(existingRaw) as OllamaConfig : null;

  const cfg: OllamaConfig = {
    version: 1,
    host,
    port,
    protocol,
    publicUrl,
    defaultModel,
    enabled,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    updatedFromInstance: context.request.headers.get('X-Patapim-Instance') || null,
  };

  await env.LICENSES.put(`ollamaConfig:${googleId}`, JSON.stringify(cfg));

  return new Response(JSON.stringify({ ok: true, config: cfg }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
