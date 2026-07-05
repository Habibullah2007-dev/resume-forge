import { createClient } from '@supabase/supabase-js';
import { aiProviderManager } from './providerManager.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // Token Validation
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

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
