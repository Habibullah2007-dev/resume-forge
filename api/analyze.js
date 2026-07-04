import { aiProviderManager } from './providerManager.js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const grokKey = process.env.GROK_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if ((!openrouterKey || openrouterKey.trim() === '') && (!grokKey || grokKey.trim() === '') && (!geminiKey || geminiKey.trim() === '')) {
      return res.status(500).json({ error: 'No AI API keys are configured on the server.' });
    }

    // Execute request using the AI Provider Manager with automatic failover
    const { result: resultText } = await aiProviderManager.callWithFallback(prompt, process.env);

    return res.status(200).json({ result: resultText });
  } catch (error) {
    console.error('API analyze error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
