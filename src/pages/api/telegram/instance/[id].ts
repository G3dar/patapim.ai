/**
 * Per-instance WebSocket upgrade endpoint.
 *
 * A PATAPIM install opens wss://remote.patapim.ai/api/telegram/instance/<id>
 * and stays connected while the app is running. The Durable Object handles
 * the socket lifecycle directly (hibernating when idle) so Worker CPU time
 * only burns when messages actually arrive.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

function parseInstanceId(id: string): string | null {
  // Accept UUID format: 32 hex chars with dashes.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  return id.toLowerCase();
}

async function handle(context: any): Promise<Response> {
  const env = context.locals.runtime.env;
  const request = context.request as Request;
  const id = String(context.params.id || '');

  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('expected websocket upgrade', { status: 426 });
  }

  const instanceId = parseInstanceId(id);
  if (!instanceId) {
    return new Response('invalid instance id', { status: 400 });
  }

  // Derive a stable DO id from the instance UUID.
  const doId = env.TELEGRAM_INSTANCE.idFromName(instanceId);
  const stub = env.TELEGRAM_INSTANCE.get(doId);
  return stub.fetch(request);
}

export const GET: APIRoute = (ctx) => handle(ctx);
