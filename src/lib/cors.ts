const ALLOWED_ORIGINS = [
  'https://patapim.ai',
  'https://www.patapim.ai',
  'null', // Electron file:// origins
];

function isAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow localhost for dev
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');
  if (!isAllowed(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin!,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export function corsOptions(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}
