/**
 * Trial Extension Endpoint
 * POST /api/extend-trial
 *
 * Body: {
 *   email: string,
 *   machineId: string,
 *   feedback: {
 *     featuresUsed: string[],     // min 2 checkboxes
 *     improvements: string,        // min 50 chars
 *     missingFeatures: string,     // min 50 chars
 *     recommendScore: number,      // 1-10
 *   }
 * }
 *
 * Returns: { success: boolean, trialEnd: string, message: string }
 */

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

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': env.SITE_URL || 'https://patapim.ai',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const { email, machineId, feedback } = body;

    // Validate required fields
    if (!email || !machineId || !feedback) {
      return jsonResponse(400, {
        success: false,
        error: 'Missing required fields: email, machineId, feedback.',
      }, corsHeaders);
    }

    // Validate feedback structure
    const validation = validateFeedback(feedback);
    if (!validation.valid) {
      return jsonResponse(400, {
        success: false,
        error: validation.error,
      }, corsHeaders);
    }

    // Check if already extended (one extension per user)
    const existingExtension = await env.FEEDBACK.get(`extension:${email}`);
    if (existingExtension) {
      return jsonResponse(400, {
        success: false,
        error: 'Trial already extended. One extension per user.',
      }, corsHeaders);
    }

    // Also check by machine ID to prevent abuse
    const machineExtension = await env.FEEDBACK.get(`machine:${machineId}`);
    if (machineExtension) {
      return jsonResponse(400, {
        success: false,
        error: 'Trial already extended on this machine.',
      }, corsHeaders);
    }

    // Calculate new trial end date
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + TRIAL_EXTENSION_DAYS);

    // Store feedback
    const feedbackData = {
      email,
      machineId,
      feedback,
      submittedAt: new Date().toISOString(),
      trialExtendedTo: trialEnd.toISOString(),
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
    };

    await env.FEEDBACK.put(
      `feedback:${email}:${Date.now()}`,
      JSON.stringify(feedbackData)
    );

    // Mark as extended
    await env.FEEDBACK.put(`extension:${email}`, trialEnd.toISOString());
    await env.FEEDBACK.put(`machine:${machineId}`, trialEnd.toISOString());

    // Store trial extension in LICENSES KV for desktop app to read
    const trialData = {
      plan: 'pro_trial',
      status: 'trial_extended',
      trialEnd: trialEnd.toISOString(),
      email,
      machineId,
      updatedAt: new Date().toISOString(),
    };

    await env.LICENSES.put(`trial:${email}`, JSON.stringify(trialData));
    await env.LICENSES.put(`trial:${machineId}`, JSON.stringify(trialData));

    return jsonResponse(200, {
      success: true,
      trialEnd: trialEnd.toISOString(),
      message: `Trial extended by ${TRIAL_EXTENSION_DAYS} days. Enjoy PATAPIM Pro!`,
    }, corsHeaders);

  } catch (err) {
    console.error('Extend trial error:', err);
    return jsonResponse(500, {
      success: false,
      error: 'Internal server error.',
    }, corsHeaders);
  }
}

function validateFeedback(feedback) {
  const { featuresUsed, improvements, missingFeatures, recommendScore } = feedback;

  // Must have at least 2 features checked
  if (!Array.isArray(featuresUsed) || featuresUsed.length < 2) {
    return { valid: false, error: 'Please select at least 2 features you use.' };
  }

  // Validate feature values
  for (const f of featuresUsed) {
    if (!VALID_FEATURES.includes(f)) {
      return { valid: false, error: `Invalid feature: ${f}` };
    }
  }

  // Improvements must be at least 50 chars
  if (typeof improvements !== 'string' || improvements.trim().length < 50) {
    return { valid: false, error: 'Improvements feedback must be at least 50 characters.' };
  }

  // Missing features must be at least 50 chars
  if (typeof missingFeatures !== 'string' || missingFeatures.trim().length < 50) {
    return { valid: false, error: 'Missing features feedback must be at least 50 characters.' };
  }

  // Recommend score must be 1-10
  if (typeof recommendScore !== 'number' || recommendScore < 1 || recommendScore > 10) {
    return { valid: false, error: 'Recommend score must be between 1 and 10.' };
  }

  // Total feedback must be at least 100 chars
  const totalLength = improvements.trim().length + missingFeatures.trim().length;
  if (totalLength < 100) {
    return { valid: false, error: 'Total feedback must be at least 100 characters.' };
  }

  // Basic gibberish check: reject if mostly repeated characters
  const uniqueChars = new Set(improvements.toLowerCase().replace(/\s/g, '')).size;
  if (uniqueChars < 8) {
    return { valid: false, error: 'Please provide genuine feedback.' };
  }

  return { valid: true };
}

function jsonResponse(status, data, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
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
