import { Hono } from 'hono';
import { logger } from 'hono/logger';

const app = new Hono();

app.use('*', logger());

const AI_MODERATION_URL = process.env.AI_MODERATION_URL || 'http://moderation-python:8000/predict';
const BANNED_KEYWORDS = [
  'f***', 's***', 'bitch', 'asshole', 'hate', 'kill', 'die', 'stupid', 'idiot', 'moron',
  'dumb', 'ugly', 'bad', 'worst', 'horrible', 'disgusting', 'terrible', 'awful',
  'violent', 'attack', 'hit', 'punch', 'kick', 'racist', 'sexist', 'homophobic',
  'trash'
];

interface AIModerationResponse {
  toxic?: number;
  severe_toxic?: number;
  obscene?: number;
  threat?: number;
  insult?: number;
  identity_hate?: number;
  [key: string]: number | undefined;
}

// Simple in-memory metrics
const metrics = {
  totalRequests: 0,
  aiSuccess: 0,
  aiRejected: 0,
  fallbackUsed: 0,
  fallbackRejected: 0,
};

async function callAIModeration(text: string): Promise<{ allowed: boolean; reason?: string; method: 'AI' | 'Fallback' }> {
  try {
    const url = new URL(AI_MODERATION_URL);
    url.searchParams.append('text', text);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`AI service returned ${response.status}`);

    const resultText = (await response.text()).trim();
    metrics.aiSuccess++;

    if (resultText === '1') {
      metrics.aiRejected++;
      return {
        allowed: false,
        reason: "This message doesn't quite match our kindness guidelines. Could you try rephrasing it to be a bit more positive?",
        method: 'AI'
      };
    }

    return { allowed: true, method: 'AI' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Moderation] AI service failure (${AI_MODERATION_URL}):`, errorMessage);
    metrics.fallbackUsed++;

    const normalizedText = text.toLowerCase();
    const foundBanned = BANNED_KEYWORDS.filter(word => normalizedText.includes(word.toLowerCase()));

    if (foundBanned.length > 0) {
      metrics.fallbackRejected++;
      return {
        allowed: false,
        reason: "We're all about good vibes here! Please avoid using unkind language so we can keep the community supportive.",
        method: 'Fallback'
      };
    }

    return { allowed: true, method: 'Fallback' };
  }
}

app.get('/metrics', (c) => c.json(metrics));

app.post('/moderate', async (c) => {
  const { text } = await c.req.json<{ text: string }>();
  metrics.totalRequests++;

  if (!text) {
    return c.json({ allowed: true });
  }

  const result = await callAIModeration(text);

  // Structured logging for decisions
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    text,
    ...result
  }));

  return c.json(result);
});

export default {
  port: 3001,
  fetch: app.fetch,
};