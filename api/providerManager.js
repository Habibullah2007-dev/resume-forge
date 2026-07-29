/**
 * Clean and parse JSON from LLM responses defensively.
 * Re-extracts and cleans code fences, unwraps data wrappers, and handles minor schema variations.
 */
function validateSchema(prompt, rawText) {
  if (!rawText) throw new Error('Empty response');

  let cleaned = rawText.trim();
  // Strip code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
  }
  cleaned = cleaned.trim();
  
  // Extract content between first '{' and last '}'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  let obj = JSON.parse(cleaned);

  // Unwrap nested wrapper keys (like { "data": {...} } or { "response": {...} })
  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    obj = obj.data;
  } else if (obj.response && typeof obj.response === 'object' && !Array.isArray(obj.response)) {
    obj = obj.response;
  }

  // Clean keys to lowercase for robust detection
  const keys = Object.keys(obj).map(k => k.toLowerCase());

  // Determine schema type based on JSON keys (prioritized)
  let schemaType = '';
  
  if (keys.includes('passed') || keys.includes('issues') || keys.includes('errors') || keys.includes('risks')) {
    schemaType = 'ats';
  } else if (keys.includes('summary') || keys.includes('skills') || keys.includes('experience') || keys.includes('professional_summary') || keys.includes('work_experience') || keys.includes('professionalsummary') || keys.includes('workexperience')) {
    schemaType = 'tailor';
  } else if (keys.some(k => k.includes('missing') || k.includes('weak') || k.includes('gap'))) {
    schemaType = 'gap';
  } else {
    // Fallback to prompt detection if keys are ambiguous or missing
    if (prompt.includes('readability') || prompt.includes('ATS') || prompt.includes('issues')) {
      schemaType = 'ats';
    } else if (prompt.includes('Rewrite') || prompt.includes('summary') || prompt.includes('experience')) {
      schemaType = 'tailor';
    } else {
      schemaType = 'gap';
    }
  }

  // Perform validation and reconstruction based on schemaType
  if (schemaType === 'gap') {
    // Gap Analysis schema check:
    // { "missing_keywords": [...], "missing_skills": [...], "weak_sections": [...] }
    
    const transformArray = (val) => {
      if (Array.isArray(val)) return val.map(String);
      if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
      return [];
    };

    const missing_keywords = transformArray(obj.missing_keywords || obj.missingKeywords || obj.missingKeywordsList);
    const missing_skills = transformArray(obj.missing_skills || obj.missingSkills || obj.missingSkillsList);
    
    let weak_sections = [];
    const rawWeak = obj.weak_sections || obj.weakSections;
    if (Array.isArray(rawWeak)) {
      weak_sections = rawWeak.map(item => {
        if (typeof item === 'string') return { section: 'General', issue: item };
        return {
          section: String(item?.section || 'General'),
          issue: String(item?.issue || item?.description || 'Improvement suggested')
        };
      });
    }

    return {
      missing_keywords,
      missing_skills,
      weak_sections
    };
  } 
  
  if (schemaType === 'tailor') {
    // Tailor & Rewrite schema check:
    // { "summary": "...", "skills": "...", "experience": "..." }
    
    const transformString = (val) => {
      if (typeof val === 'string') return val.trim();
      if (Array.isArray(val)) return val.map(String).join('\n');
      if (val) return String(val).trim();
      return '';
    };

    const summary = transformString(obj.summary || obj.professional_summary || obj.professionalSummary);
    const skills = transformString(obj.skills || obj.skills_list || obj.skillsList);
    const experience = transformString(obj.experience || obj.work_experience || obj.workExperience);
    
    const education = transformString(obj.education);
    const certifications = transformString(obj.certifications);
    const awards = transformString(obj.awards);
    
    let supporting_doc_adds = [];
    const rawAdds = obj.supporting_doc_adds || obj.supportingDocAdds;
    if (Array.isArray(rawAdds)) {
      supporting_doc_adds = rawAdds.map(String);
    }

    if (!summary || !skills || !experience) {
      throw new Error('Missing expected fields for Tailor & Rewrite schema');
    }

    return {
      summary,
      skills,
      experience,
      education,
      certifications,
      awards,
      supporting_doc_adds
    };
  }

  if (schemaType === 'ats') {
    // ATS Check schema check:
    // { "issues": [...], "passed": ... }
    
    const transformArray = (val) => {
      if (Array.isArray(val)) return val.map(String);
      if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
      return [];
    };

    const issues = transformArray(obj.issues || obj.errors || obj.risks);
    const passed = typeof obj.passed === 'boolean' ? obj.passed : (String(obj.passed).toLowerCase() === 'true');

    return {
      issues,
      passed
    };
  }

  return obj;
}

/**
 * AIProviderManager handles multiple AI API providers with automatic failover,
 * status tracking, and temporary cooldowns.
 */
class AIProviderManager {
  constructor() {
    this.providers = [
      {
        name: 'Gemini',
        apiKeyEnvName: 'GEMINI_API_KEY',
        endpoint: (apiKey) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        headers: () => ({
          'Content-Type': 'application/json'
        }),
        requestBody: (prompt) => ({
          contents: [{ parts: [{ text: prompt }] }]
        }),
        extractResult: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text,
        status: 'healthy',
        failureCount: 0,
        lastFailure: null,
        cooldownUntil: null
      },
      {
        name: 'Groq',
        apiKeyEnvName: 'GROQ_API_KEY',
        endpoint: () => 'https://api.groq.com/openai/v1/chat/completions',
        headers: (apiKey) => ({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }),
        requestBody: (prompt) => ({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }]
        }),
        extractResult: (data) => data.choices?.[0]?.message?.content,
        status: 'healthy',
        failureCount: 0,
        lastFailure: null,
        cooldownUntil: null
      },
      {
        name: 'OpenRouter',
        apiKeyEnvName: 'OPENROUTER_API_KEY',
        endpoint: () => 'https://openrouter.ai/api/v1/chat/completions',
        headers: (apiKey) => ({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://resumeforge.com',
          'X-Title': 'ResumeForge'
        }),
        requestBody: (prompt) => ({
          model: 'openrouter/free',
          messages: [{ role: 'user', content: prompt }]
        }),
        extractResult: (data) => data.choices?.[0]?.message?.content,
        status: 'healthy',
        failureCount: 0,
        lastFailure: null,
        cooldownUntil: null
      }
    ];
  }

  /**
   * Retrieves the currently active provider based on health status and configured API keys.
   * Automatically recovers a provider if its cooldown duration has elapsed.
   */
  getCurrentProvider(env) {
    const now = new Date();

    // Check for cooldown recoveries
    for (const p of this.providers) {
      if (p.status === 'cooldown' && p.cooldownUntil && now >= p.cooldownUntil) {
        p.status = 'healthy';
        p.failureCount = 0;
        p.cooldownUntil = null;
        console.info(`[AIProviderManager] Cooldown expired for ${p.name}. Restored to active healthy status.`);
      }
    }

    // Return the first healthy provider that has an API key configured
    for (const p of this.providers) {
      let apiKey = env[p.apiKeyEnvName] || process.env[p.apiKeyEnvName];
      if (p.apiKeyEnvName === 'GROQ_API_KEY' && (!apiKey || apiKey.trim() === '')) {
        // Fallback checks for GROK_API_KEY key typo
        apiKey = env['GROK_API_KEY'] || process.env['GROK_API_KEY'];
      }

      if (apiKey && apiKey.trim() !== '' && apiKey !== 'your_openrouter_api_key_here') {
        if (p.status === 'healthy') {
          return p;
        }
      }
    }

    // Default fallback to first provider if all are configured but none healthy
    return this.providers[0];
  }

  /**
   * Switches to the next available provider in rotation.
   */
  switchProvider(currentProvider) {
    const currentIndex = this.providers.indexOf(currentProvider);
    const nextIndex = (currentIndex + 1) % this.providers.length;
    const nextProvider = this.providers[nextIndex];
    console.info(`[AIProviderManager] Switching provider from ${currentProvider.name} to ${nextProvider.name}...`);
    return nextProvider;
  }

  /**
   * Marks a provider as healthy and resets its failure statistics.
   */
  markProviderHealthy(provider) {
    if (provider.failureCount > 0) {
      console.info(`[AIProviderManager] Provider ${provider.name} call succeeded. Resetting statistics.`);
    }
    provider.status = 'healthy';
    provider.failureCount = 0;
    provider.cooldownUntil = null;
  }

  /**
   * Marks a provider as failed, increments counts, and starts a 10 minute cooldown if failures repeat.
   */
  markProviderFailed(provider, errorMsg) {
    provider.failureCount++;
    provider.lastFailure = new Date();
    console.error(`[AIProviderManager] ${provider.name} failed (Failure Count: ${provider.failureCount}). Error: ${errorMsg}`);

    // Set temporary 10-minute cooldown if repeated failures occur
    if (provider.failureCount >= 2) {
      const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
      provider.status = 'cooldown';
      provider.cooldownUntil = new Date(Date.now() + COOLDOWN_MS);
      console.warn(`[AIProviderManager] ${provider.name} entered 10-minute cooldown until ${provider.cooldownUntil.toISOString()}.`);
    }
  }

  /**
   * Shared function callWithFallback: loops through the provider array in order,
   * tries each provider, handles rate limits and other failures by logging and continuing.
   */
  async callWithFallback(prompt, env) {
    let lastError = null;
    let hadSchemaFailure = false;
    
    // We try all providers sequentially starting from Gemini (priority order)
    for (const provider of this.providers) {
      let apiKey = env[provider.apiKeyEnvName] || process.env[provider.apiKeyEnvName];
      if (provider.apiKeyEnvName === 'GROQ_API_KEY' && (!apiKey || apiKey.trim() === '')) {
        // Fallback checks for GROK_API_KEY key typo
        apiKey = env['GROK_API_KEY'] || process.env['GROK_API_KEY'];
      }

      if (!apiKey || apiKey.trim() === '' || apiKey === 'your_openrouter_api_key_here') {
        console.warn(`[AIProviderManager] Skipping ${provider.name} because its API key is not configured.`);
        continue;
      }

      console.info(`[AIProviderManager] Attempting request using provider ${provider.name}...`);

      try {
        const endpoint = provider.endpoint(apiKey);
        const headers = provider.headers(apiKey);
        const body = provider.requestBody(prompt);

        const timeoutSignal = AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: timeoutSignal
        });

        // Failover on rate limits (429, 402, or specific status codes)
        const isRateLimitStatus = response.status === 429 || response.status === 402;
        const errText = !response.ok ? await response.text().catch(() => '') : '';

        const isRateLimitMessage = errText && (
          errText.toLowerCase().includes('rate limit') || 
          errText.toLowerCase().includes('quota') || 
          errText.toLowerCase().includes('free-models-per-day')
        );

        if (!response.ok) {
          const errorMsg = `HTTP ${response.status}: ${errText || 'Unknown error'}`;
          
          if (isRateLimitStatus || isRateLimitMessage) {
            console.warn(`[AIProviderManager] ${provider.name} rate limit exceeded. Error: ${errorMsg}. Moving to next provider.`);
          } else {
            console.error(`[AIProviderManager] ${provider.name} request failed: ${errorMsg}. Attempting fallback...`);
          }
          
          this.markProviderFailed(provider, errorMsg);
          lastError = new Error(errorMsg);
          continue;
        }

        const data = await response.json();
        const text = provider.extractResult(data);

        if (!text) {
          throw new Error('Response JSON did not contain a valid result text.');
        }

        // Validate the response schema on the server
        try {
          const validatedJson = validateSchema(prompt, text);
          this.markProviderHealthy(provider);
          console.info(`[AIProviderManager] Request succeeded with provider ${provider.name}.`);
          return { result: JSON.stringify(validatedJson), provider: provider.name };
        } catch (schemaErr) {
          hadSchemaFailure = true;
          console.error(`[AIProviderManager] Server response schema was invalid for provider ${provider.name}.`);
          console.error(`[AIProviderManager] Raw response text before validation failed:`, text);
          
          const errorMsg = `Server response schema was invalid. Please try again.`;
          this.markProviderFailed(provider, errorMsg);
          lastError = schemaErr;
          continue;
        }

      } catch (err) {
        console.error(`[AIProviderManager] Exception occurred with provider ${provider.name}:`, err.message);
        this.markProviderFailed(provider, err.message || 'Network/Timeout exception');
        lastError = err;
      }
    }

    if (hadSchemaFailure) {
      throw new Error('Server response schema was invalid. Please try again.');
    }
    throw new Error('All AI providers are currently unavailable or rate-limited. Please try again later.');
  }

  // Backwards compatibility helper
  async retryRequest(prompt, env) {
    const { result } = await this.callWithFallback(prompt, env);
    return result;
  }
}

export const aiProviderManager = new AIProviderManager();
