const GEMINI_MODEL = 'gemini-2.5-flash-image';

export default async function imageGen({ prompt }) {
  if (!prompt || typeof prompt !== 'string') {
    return { status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Missing "prompt" field' }) };
  }

  if (prompt.length > 2000) {
    return { status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Prompt too long (max 2000 chars)' }) };
  }

  const apiKey = process.env.GOOGLE_STUDIO_API_KEY;
  if (!apiKey) {
    console.error('[image-gen] GOOGLE_STUDIO_API_KEY not set');
    return { status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Service misconfigured' }) };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[image-gen] Gemini ${res.status}:`, err);
    return { status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Image generation failed' }) };
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData);

  if (!imagePart) {
    return { status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'No image returned' }) };
  }

  const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
  return { contentType: imagePart.inlineData.mimeType || 'image/png', body: buffer };
}
