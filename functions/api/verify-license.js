/**
 * License Verification Endpoint
 * POST /api/verify-license
 *
 * Body: { licenseKey: string } or { email: string }
 * Returns: { valid: boolean, plan: string, status: string, ... }
 *
 * Called by the desktop app on startup to check license status.
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const { licenseKey, email } = body;

    if (!licenseKey && !email) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Missing licenseKey or email.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let key = licenseKey;

    // Look up by email if no license key provided
    if (!key && email) {
      key = await env.LICENSES.get(`email:${email}`);
      if (!key) {
        return new Response(
          JSON.stringify({ valid: false, plan: 'free', status: 'no_license' }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Validate key format
    if (!key || !/^PTPM-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid license key format.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const data = await env.LICENSES.get(`license:${key}`, { type: 'json' });

    if (!data) {
      return new Response(
        JSON.stringify({ valid: false, plan: 'free', status: 'not_found' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const isActive = data.status === 'active';

    return new Response(
      JSON.stringify({
        valid: isActive,
        licenseKey: key,
        plan: isActive ? 'pro' : 'free',
        status: data.status,
        customerEmail: data.customerEmail,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('Verify license error:', err);
    return new Response(
      JSON.stringify({ valid: false, error: 'Internal server error.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
