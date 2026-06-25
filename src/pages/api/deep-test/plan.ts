import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';
import { plan, json } from '../../../lib/deepTest';

export const prerender = false;

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

export const GET: APIRoute = ({ request }) => json(plan, 200, getCorsHeaders(request));
