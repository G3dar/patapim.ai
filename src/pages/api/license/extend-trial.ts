import type { APIRoute } from 'astro';
import { getCorsHeaders, corsOptions } from '../../../lib/cors';

export const prerender = false;

const TRIAL_EXTENSION_DAYS = 14;

const VALID_FEATURES = [
  'multi-terminal',
  'grid-view',
  'remote-access',
  'voice-dictation',
  'task-management',
  'github-integration',
  'plugin-system',
  'mcp-browser',
  'file-editor',
  'context-preservation',
  'passkey-auth',
  'keyboard-shortcuts',
];

function validateFeedback(feedback: any): { valid: boolean; error?: string } {
  const { featuresUsed, improvements, missingFeatures, recommendScore } = feedback;

  if (!Array.isArray(featuresUsed) || featuresUsed.length < 2) {
    return { valid: false, error: 'Please select at least 2 features you use.' };
  }

  for (const f of featuresUsed) {
    if (!VALID_FEATURES.includes(f)) {
      return { valid: false, error: `Invalid feature: ${f}` };
    }
  }

  if (typeof improvements !== 'string' || improvements.trim().length < 50) {
    return { valid: false, error: 'Improvements feedback must be at least 50 characters.' };
  }

  if (typeof missingFeatures !== 'string' || missingFeatures.trim().length < 50) {
    return { valid: false, error: 'Missing features feedback must be at least 50 characters.' };
  }

  if (typeof recommendScore !== 'number' || recommendScore < 1 || recommendScore > 10) {
    return { valid: false, error: 'Recommend score must be between 1 and 10.' };
  }

  const totalLength = improvements.trim().length + missingFeatures.trim().length;
  if (totalLength < 100) {
    return { valid: false, error: 'Total feedback must be at least 100 characters.' };
  }

  const uniqueChars = new Set(improvements.toLowerCase().replace(/\s/g, '')).size;
  if (uniqueChars < 8) {
    return { valid: false, error: 'Please provide genuine feedback.' };
  }

  return { valid: true };
}

export const OPTIONS: APIRoute = ({ request }) => corsOptions(request);

export const POST: APIRoute = async (context) => {
  const env = context.locals.runtime.env;
  const cors = getCorsHeaders(context.request);
  const headers = { 'Content-Type': 'application/json', ...cors };

  let body: { email?: string; machineId?: string; feedback?: any };
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), { status: 400, headers });
  }

  const { email, machineId, feedback } = body;

  if (!email || !machineId || !feedback) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing required fields: email, machineId, feedback.',
    }), { status: 400, headers });
  }

  const validation = validateFeedback(feedback);
  if (!validation.valid) {
    return new Response(JSON.stringify({ success: false, error: validation.error }), { status: 400, headers });
  }

  // Check if already extended (one per user)
  const existingExtension = await env.FEEDBACK.get(`extension:${email}`);
  if (existingExtension) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Trial already extended. One extension per user.',
    }), { status: 400, headers });
  }

  // Check by machine ID
  const machineExtension = await env.FEEDBACK.get(`machine:${machineId}`);
  if (machineExtension) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Trial already extended on this machine.',
    }), { status: 400, headers });
  }

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + TRIAL_EXTENSION_DAYS);
  const now = new Date().toISOString();

  const feedbackData = {
    email,
    machineId,
    feedback,
    submittedAt: now,
    trialExtendedTo: trialEnd.toISOString(),
    ip: context.request.headers.get('CF-Connecting-IP') || 'unknown',
  };

  await env.FEEDBACK.put(`feedback:${email}:${Date.now()}`, JSON.stringify(feedbackData));
  await env.FEEDBACK.put(`extension:${email}`, trialEnd.toISOString());
  await env.FEEDBACK.put(`machine:${machineId}`, trialEnd.toISOString());

  const trialData = {
    plan: 'pro_trial',
    status: 'trial_extended',
    trialEnd: trialEnd.toISOString(),
    email,
    machineId,
    updatedAt: now,
  };

  await Promise.all([
    env.LICENSES.put(`trial:${email}`, JSON.stringify(trialData)),
    env.LICENSES.put(`trial:${machineId}`, JSON.stringify(trialData)),
  ]);

  return new Response(JSON.stringify({
    success: true,
    trialEnd: trialEnd.toISOString(),
    message: `Trial extended by ${TRIAL_EXTENSION_DAYS} days. Enjoy PATAPIM Pro!`,
  }), { status: 200, headers });
};
