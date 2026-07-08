const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// history: [{ role: 'user' | 'assistant', content: string }]
export async function callGemini(systemPrompt, history) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'Server has no GEMINI_API_KEY configured. Add it to .env and restart the server.' };
  }

  const contents = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { maxOutputTokens: 1000 },
        }),
      }
    );

    const data = await response.json();
    const candidate = data && data.candidates && data.candidates[0];
    const parts = candidate && candidate.content && candidate.content.parts;

    if (parts && parts.length) {
      const text = parts.map((p) => p.text || '').filter(Boolean).join('\n');
      if (text) return { ok: true, text };
    }

    const reason = (data && data.error && data.error.message) || 'The AI did not return a reply.';
    return { ok: false, error: reason };
  } catch (err) {
    return { ok: false, error: 'Could not reach the AI provider. Please try again.' };
  }
}
