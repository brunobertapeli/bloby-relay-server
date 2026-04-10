const YOUTUBE_RE = /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/;
const GEMINI_MODEL = 'gemini-2.5-flash';

export default async function youtubeToText({ url }) {
  if (!url || typeof url !== 'string') {
    return { status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Missing "url" field' }) };
  }

  const match = url.match(YOUTUBE_RE);
  if (!match) {
    return { status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid YouTube URL' }) };
  }

  const canonicalUrl = `https://www.youtube.com/watch?v=${match[1]}`;
  const apiKey = process.env.GOOGLE_STUDIO_API_KEY;
  if (!apiKey) {
    console.error('[youtube-to-text] GOOGLE_STUDIO_API_KEY not set');
    return { status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Service misconfigured' }) };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: 'Transcribe the audio from this video. Return only the spoken text, nothing else. Do not add any commentary, timestamps, or formatting — just the raw transcript.' },
          { fileData: { mimeType: 'video/*', fileUri: canonicalUrl } },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[youtube-to-text] Gemini ${res.status}:`, err);
    return { status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Transcription failed' }) };
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return { status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'No transcript returned' }) };
  }

  return { contentType: 'text/plain', body: text };
}
