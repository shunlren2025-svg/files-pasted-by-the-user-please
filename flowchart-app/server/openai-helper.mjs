import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import { AI_INSTRUCTIONS, MODEL } from './ai-instructions.mjs';

const PORT = Number(process.env.FLOWCHART_PORT || 8787);
const ENV_PATH = new URL('../.env', import.meta.url);

function getKey() {
  try {
    const line = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/).find((item) => item.startsWith('OPENAI_API_KEY='));
    return line?.slice('OPENAI_API_KEY='.length).trim() || '';
  } catch {
    return '';
  }
}

function localAddresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses;
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
    response.end();
    return;
  }
  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, { ok: true, helper: 'FlowChart AI helper' });
    return;
  }
  if (request.method !== 'POST' || request.url !== '/ai') {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  let raw = '';
  request.on('data', (chunk) => { raw += chunk; });
  request.on('end', async () => {
    try {
      const { message, images = [] } = JSON.parse(raw || '{}');
      if (typeof message !== 'string' || !message.trim()) {
        sendJson(response, 400, { error: 'Please enter a question or planning note.' });
        return;
      }
      const apiKey = getKey();
      if (!apiKey || apiKey === 'paste-your-key-here') {
        sendJson(response, 503, { error: 'The AI helper needs a valid key in the local .env file.' });
        return;
      }
      const content = [{ type: 'input_text', text: message.trim() }];
      for (const image of Array.isArray(images) ? images.slice(0, 3) : []) {
        if (typeof image === 'string' && image.startsWith('data:image/')) content.push({ type: 'input_image', image_url: image });
      }
      const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: MODEL, instructions: AI_INSTRUCTIONS, input: [{ role: 'user', content }] })
      });
      const result = await openAiResponse.json();
      if (!openAiResponse.ok) {
        sendJson(response, 502, { error: 'The AI could not answer right now. Check the key and the helper.' });
        return;
      }
      sendJson(response, 200, { answer: result.output_text || 'I could not find an answer. Try asking in a different way.' });
    } catch {
      sendJson(response, 500, { error: 'I could not reach the AI. Check the key and the helper.' });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const urls = localAddresses().map((address) => `http://${address}:${PORT}`);
  console.log(`FlowChart AI helper is ready on port ${PORT}.`);
  if (urls.length) console.log(`Phone helper address: ${urls[0]}`);
});
