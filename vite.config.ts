import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import { aiProviderManager } from './api/providerManager.js';

// Helper to determine mock response depending on the prompt type
function getMockResult(prompt: string) {
  const isAtsCheck = 
    prompt.includes('ATS risks') || 
    prompt.includes('stuffing') || 
    prompt.includes('passed') || 
    prompt.includes('issues');

  if (isAtsCheck) {
    if (prompt.includes('warn')) {
      return {
        issues: [
          "Potential keyword stuffing of 'React Context' in the Professional Summary.",
          "Missing standard section header for 'Certifications & Education'."
        ],
        passed: false
      };
    }
    return {
      issues: [],
      passed: true
    };
  }

  const isTailorRequest = 
    prompt.includes('Rewrite the Professional Summary') || 
    prompt.includes('NEVER invent metrics') || 
    prompt.includes('align with the provided ATS Gap Analysis');

  if (isTailorRequest) {
    return {
      summary: "Result-oriented Frontend Engineer with 5+ years of experience specializing in React, TypeScript, and Tailwind CSS. Proven track record of leveraging React Context for efficient state management and optimizing client-side performance, resulting in faster load times. Experienced in building responsive web designs, unit testing with Jest, and deploying through CI/CD pipelines to ensure seamless user experiences.",
      skills: "Frontend Development: React, TypeScript, Tailwind CSS, Vite, HTML5, CSS3, JavaScript (ES6+)\nState Management & Testing: React Context, Jest, React Testing Library\nTooling & DevOps: Git, GitHub, CI/CD, npm, webpack, Vite, ATS Optimization",
      experience: "Senior Frontend Engineer | TechCorp (2024 - Present)\n- Led cross-functional Agile engineering teams, accelerating software delivery lifecycle by 15%.\n- Developed complex web applications using React, TypeScript, and Vite, improving build times by 20%.\n- Re-architected application state management using React Context, reducing prop drilling and enhancing maintainability.\n- Formulated unit testing strategies using Jest, expanding test coverage by 30% to secure release cycles.\n- Optimized mobile-first responsive web designs, ensuring high-quality compatibility across all viewport sizes."
    };
  }

  return {
    missing_keywords: ["React Context", "Vite", "Tailwind CSS", "Jest", "CI/CD"],
    missing_skills: ["Responsive Web Design", "Unit Testing", "State Management", "ATS Optimization"],
    weak_sections: [
      {
        section: "Professional Experience",
        issue: "Suggested achievements lack metrics. Recommend adding percentages or delivery speed metrics to React projects."
      },
      {
        section: "Skills List",
        issue: "Omitted key frontend tooling keywords (Vite, Tailwind, Jest) present in the job requirements."
      }
    ]
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables (including those without VITE_ prefix) in the current directory
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'api-dev-server',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.startsWith('/api/analyze') && req.method === 'POST') {
              let body = '';
              req.on('data', (chunk) => {
                body += chunk;
              });
              
              req.on('end', async () => {
                try {
                  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
                  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

                  if (supabaseUrl && supabaseAnonKey) {
                    const authHeader = req.headers.authorization;
                    if (!authHeader || !authHeader.startsWith('Bearer ')) {
                      res.writeHead(401, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({ error: 'Missing or invalid authorization header' }));
                      return;
                    }
                    const token = authHeader.split(' ')[1];
                    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
                    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
                    if (authError || !user) {
                      res.writeHead(401, { 'Content-Type': 'application/json' });
                      res.end(JSON.stringify({ error: 'Unauthorized: Invalid token' }));
                      return;
                    }
                  } else {
                    console.warn('[Local API Dev Middleware] Supabase environment variables are missing. Bypassing JWT auth check.');
                  }

                  const { prompt } = JSON.parse(body);
                  if (!prompt) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Prompt is required' }));
                    return;
                  }

                  const openrouterKey = env.OPENROUTER_API_KEY;
                  const grokKey = env.GROK_API_KEY;
                  const geminiKey = env.GEMINI_API_KEY;
                  const isMockMode = (!openrouterKey || openrouterKey === 'your_openrouter_api_key_here' || openrouterKey.trim() === '') &&
                                     (!grokKey || grokKey.trim() === '') &&
                                     (!geminiKey || geminiKey.trim() === '');

                  if (isMockMode) {
                    console.info(`[Local API Dev Middleware] Running in Mock Mode. Returning mock data.`);
                    const mockResult = getMockResult(prompt);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ result: JSON.stringify(mockResult) }));
                    return;
                  }

                  // Execute request using the AI Provider Manager with automatic failover
                  const { result: resultText } = await aiProviderManager.callWithFallback(prompt, env);

                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ result: resultText }));
                } catch (error: any) {
                  console.error('Local API Dev Middleware Error:', error);
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: error.message || 'Internal server error' }));
                }
              });
            } else {
              next();
            }
          });
        },
      },
    ],
  };
});
