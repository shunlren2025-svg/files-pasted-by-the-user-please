import { AI_INSTRUCTIONS, MODEL } from '../server/ai-instructions.mjs';

async function getKey() {
  const keygenUrl = process.env.KEYGEN_URL;
  const keygenToken = process.env.KEYGEN_TOKEN;
  if (!keygenUrl || !keygenToken) {
    throw new Error('Vercel needs KEYGEN_URL and KEYGEN_TOKEN to use the online AI helper.');
  }

  const response = await fetch(keygenUrl, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${keygenToken}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('The online key service could not be reached.');
  const key = body.key || body.apiKey || body.data?.key || body.data?.apiKey;
  if (!key) throw new Error('The online key service did not return an AI key.');
  return key;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Use POST to ask FlowChart a question.' });
    return;
  }

  try {
    const message = request.body?.message;
    const images = request.body?.images;
    if (typeof message !== 'string' || !message.trim()) {
      response.status(400).json({ error: 'Please enter a question or planning note.' });
      return;
    }

    const apiKey = await getKey();
    const content = [{ type: 'input_text', text: message.trim() }];
    for (const image of Array.isArray(images) ? images.slice(0, 3) : []) {
      if (typeof image === 'string' && image.startsWith('data:image/')) content.push({ type: 'input_image', image_url: image });
    }
    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, instructions: AI_INSTRUCTIONS, input: [{ role: 'user', content }] }),
    });
    const result = await openAiResponse.json().catch(() => ({}));
    if (!openAiResponse.ok) throw new Error('The AI could not answer right now. Please try again.');
    response.status(200).json({ answer: result.output_text || 'Try asking that in a different way.' });
  } catch (error) {
    response.status(500).json({ error: error?.message || 'The online AI helper is unavailable right now.' });
  }
}
