import { Hono } from 'hono';

const app = new Hono();

// Basic profanity and negative keyword list
// In a real app, this would be much more extensive or use an AI model
const BANNED_KEYWORDS = [
  'f***', 's***', 'bitch', 'asshole', 'hate', 'kill', 'die', 'stupid', 'idiot', 'moron',
  'dumb', 'ugly', 'bad', 'worst', 'horrible', 'disgusting', 'terrible', 'awful',
  'violent', 'attack', 'hit', 'punch', 'kick', 'racist', 'sexist', 'homophobic'
];

app.post('/moderate', async (c) => {
  const { text } = await c.req.json<{ text: string }>();

  if (!text) {
    return c.json({ allowed: false, reason: 'No text provided' }, 400);
  }

  const normalizedText = text.toLowerCase();
  const foundBanned = BANNED_KEYWORDS.filter(word => normalizedText.includes(word.toLowerCase()));

  if (foundBanned.length > 0) {
    return c.json({
      allowed: false,
      reason: `Content contains unkind or prohibited language: ${foundBanned.join(', ')}`
    });
  }

  // Length check (though frontend and main backend should also handle this)
  if (text.length > 280) {
    return c.json({ allowed: false, reason: 'Message exceeds 280 character limit' });
  }

  return c.json({ allowed: true });
});

export default {
  port: 3001,
  hostname: '0.0.0.0',
  fetch: app.fetch,
};