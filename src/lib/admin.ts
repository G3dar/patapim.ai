/**
 * Admin auth guard and KV enumeration helpers
 */

import { getUserFromRequest, type SessionUser } from './auth';

const ADMIN_EMAIL = 'g@3dar.com';

export function isAdmin(user: SessionUser): boolean {
  return user.email === ADMIN_EMAIL;
}

export async function requireAdmin(
  sessions: KVNamespace,
  request: Request
): Promise<{ user: SessionUser } | { response: Response }> {
  const user = await getUserFromRequest(sessions, request);
  if (!user) {
    return { response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } }) };
  }
  if (!isAdmin(user)) {
    return { response: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } }) };
  }
  return { user };
}

/**
 * List all KV keys with a given prefix, handling cursor pagination.
 */
export async function listAllKeys(kv: KVNamespace, prefix: string): Promise<{ name: string }[]> {
  const keys: { name: string }[] = [];
  let cursor: string | undefined;

  do {
    const result = await kv.list({ prefix, cursor, limit: 1000 });
    keys.push(...result.keys.map(k => ({ name: k.name })));
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  return keys;
}

/**
 * Batch-fetch KV values for a list of keys, in groups of 50.
 */
export async function fetchAllValues<T = any>(kv: KVNamespace, keys: string[]): Promise<Map<string, T>> {
  const results = new Map<string, T>();
  const batchSize = 50;

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    const values = await Promise.all(batch.map(k => kv.get(k)));
    for (let j = 0; j < batch.length; j++) {
      if (values[j]) {
        try {
          results.set(batch[j], JSON.parse(values[j]!) as T);
        } catch {
          // skip unparseable values
        }
      }
    }
  }

  return results;
}
