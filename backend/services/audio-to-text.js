// Audio → text via Groq Whisper. Billed per-minute by the route's
// applyPerMinutePricing middleware before the payment chain runs; this
// handler just runs the transcription and reports back.
//
// Pricing is locked in *before* this code executes (see routes/services.js).
// The `groqDurationSec` field returned here is observational only — useful
// for tuning `assumedBitrateBps` later, never for billing.

const DEFAULT_MODEL = 'whisper-large-v3-turbo';
const ALLOWED_MODELS = new Set([
  'whisper-large-v3-turbo',
  'whisper-large-v3',
  'distil-whisper-large-v3-en',
]);

const ESTIMATE_DRIFT_WARN = 0.3; // log when |groqSec/estimateSec - 1| > 30%

export default async function audioToText(body, ctx) {
  if (!ctx?.file) {
    return {
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Missing audio file (multipart field "file")' }),
    };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('[audio-to-text] GROQ_API_KEY not set');
    return {
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Service misconfigured' }),
    };
  }

  const requestedModel = typeof body?.model === 'string' ? body.model : null;
  const model = requestedModel && ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;
  const language = typeof body?.language === 'string' && body.language.length <= 5
    ? body.language
    : null;

  const form = new FormData();
  const blob = new Blob([ctx.file.buffer], { type: ctx.file.mimetype || 'application/octet-stream' });
  form.append('file', blob, ctx.file.originalname || 'audio.opus');
  form.append('model', model);
  form.append('response_format', 'verbose_json');
  if (language) form.append('language', language);

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[audio-to-text] Groq ${res.status}:`, errText.slice(0, 500));
    return {
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Transcription failed' }),
    };
  }

  const data = await res.json();
  const transcript = typeof data?.text === 'string' ? data.text : null;
  if (transcript === null) {
    return {
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'No transcript returned' }),
    };
  }

  const groqDurationSec = typeof data?.duration === 'number' ? data.duration : null;
  if (groqDurationSec !== null && ctx.estimatedMinutes > 0) {
    const estimatedSec = ctx.estimatedMinutes * 60;
    const drift = Math.abs(groqDurationSec / estimatedSec - 1);
    if (drift > ESTIMATE_DRIFT_WARN) {
      console.warn(
        `[audio-to-text] Estimate/actual drift ${(drift * 100).toFixed(0)}% — ` +
        `estimated=${estimatedSec}s, groq=${groqDurationSec.toFixed(1)}s, ` +
        `file=${ctx.file.size}B, assumedBitrateBps=${ctx.assumedBitrateBps || 'default'}`,
      );
    }
  }

  return {
    contentType: 'application/json',
    body: JSON.stringify({
      transcript,
      language: data?.language ?? language ?? null,
      estimatedMinutes: ctx.estimatedMinutes,
      priceUsd: ctx.priceUsd,
      paidVia: ctx.paidVia,
      groqDurationSec,
      model,
    }),
  };
}
