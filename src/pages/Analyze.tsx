import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, Navigate } from 'react-router-dom';
import type { AppContextType } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const Analyze: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const {
    resumeText,
    jobDescriptionText,
    supportingText,
    analysisResult,
    setAnalysisResult,
  } = useOutletContext<AppContextType>();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cleanJsonString = (raw: string): string => {
    let cleaned = raw.trim();
    // Strip markdown code fences if present (e.g. ```json ... ``` or ``` ... ```)
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
    }
    cleaned = cleaned.trim();
    
    // Find the first '{' and the last '}'
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return cleaned;
  };

  const runAnalysis = async () => {
    if (!resumeText || !jobDescriptionText) return;

    setIsLoading(true);
    setErrorMsg(null);

    const prompt = `
You are an expert resume analyzer and ATS optimization tool.
Analyze the following resume and job description. Identify keywords and skills that are missing in the resume compared to the job description, and point out any weak sections in the resume (with actionable descriptions of why they are weak).

You MUST return ONLY valid JSON with this exact shape:
{
  "missing_keywords": ["keyword1", "keyword2", ...],
  "missing_skills": ["skill1", "skill2", ...],
  "weak_sections": [
    { "section": "section name", "issue": "specific reason or gap identified in this section" }
  ]
}

Ensure your response contains ONLY the JSON payload. Do NOT wrap it in markdown code fences, do not add trailing explanations, and do not add any text before or after the JSON.

---
JOB DESCRIPTION:
${jobDescriptionText}

---
RESUME TEXT:
${resumeText}

${supportingText ? `---\nSUPPORTING DOCUMENTS:\n${supportingText}` : ''}

Respond with ONLY the JSON object. Do not include any explanation, safety notes, classification labels, or text before or after the JSON.
`;

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API returned status ${response.status}`);
      }

      const data = await response.json();
      const rawText = data.result;
      if (!rawText) {
        throw new Error('Empty response received from the analyzer server.');
      }

      let parsedResult;
      try {
        const cleanedText = cleanJsonString(rawText);
        parsedResult = JSON.parse(cleanedText);
      } catch (jsonErr) {
        console.error('JSON parsing error:', jsonErr);
        throw new Error('The AI returned an unexpected format — please retry');
      }

      // Validate schema minimally
      if (
        !Array.isArray(parsedResult.missing_keywords) ||
        !Array.isArray(parsedResult.missing_skills) ||
        !Array.isArray(parsedResult.weak_sections)
      ) {
        throw new Error('Server response schema was invalid. Please try again.');
      }

      setAnalysisResult(parsedResult);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to complete gap analysis. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Automatically trigger analysis if we don't have results yet
    if (resumeText && jobDescriptionText && !analysisResult && !isLoading && !errorMsg) {
      runAnalysis();
    }
  }, [resumeText, jobDescriptionText, analysisResult]);

  // Protect route
  if (!resumeText || !jobDescriptionText) {
    return <Navigate to="/upload" replace />;
  }

  if (isLoading) {
    return (
      <div className="space-y-10">
        <div>
          <span className="text-xs font-semibold tracking-widest text-brand uppercase">Step 2 of 4</span>
          <h1 className="text-3xl font-bold tracking-tight text-black mt-1">Gap Analysis</h1>
          <p className="text-gray-500 mt-2 text-sm">Comparing your resume to the target role...</p>
        </div>

        <div className="space-y-8 border border-gray-100 rounded-lg p-6 bg-white shadow-sm">
          {/* Missing Keywords Skeleton */}
          <div className="space-y-3">
            <div className="h-4 w-1/4 bg-gray-200 animate-pulse rounded"></div>
            <div className="flex flex-wrap gap-2">
              <div className="h-7 w-24 bg-gray-200 animate-pulse rounded-full"></div>
              <div className="h-7 w-20 bg-gray-200 animate-pulse rounded-full"></div>
              <div className="h-7 w-28 bg-gray-200 animate-pulse rounded-full"></div>
              <div className="h-7 w-16 bg-gray-200 animate-pulse rounded-full"></div>
            </div>
          </div>

          {/* Missing Skills Skeleton */}
          <div className="space-y-3">
            <div className="h-4 w-1/4 bg-gray-200 animate-pulse rounded"></div>
            <div className="flex flex-wrap gap-2">
              <div className="h-7 w-32 bg-gray-200 animate-pulse rounded-full"></div>
              <div className="h-7 w-24 bg-gray-200 animate-pulse rounded-full"></div>
              <div className="h-7 w-28 bg-gray-200 animate-pulse rounded-full"></div>
            </div>
          </div>

          {/* Weak Sections Skeleton */}
          <div className="space-y-3">
            <div className="h-4 w-1/4 bg-gray-200 animate-pulse rounded"></div>
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="border-l-2 border-gray-100 pl-4 py-1 space-y-2">
                  <div className="h-4 w-1/3 bg-gray-200 animate-pulse rounded"></div>
                  <div className="h-3 w-2/3 bg-gray-200 animate-pulse rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="space-y-6">
        <div className="p-4 bg-red-50 border-l-2 border-red-600 text-red-800 rounded-r text-sm">
          <p className="font-semibold">Analysis Failed</p>
          <p className="mt-1 text-xs">{errorMsg}</p>
        </div>
        <div className="flex justify-between">
          <button
            onClick={() => navigate('/upload')}
            className="border border-gray-200 text-gray-600 px-6 py-2.5 rounded font-medium text-sm hover:bg-gray-50 transition-colors duration-200"
          >
            Back to Upload
          </button>
          <button
            onClick={runAnalysis}
            className="bg-brand text-white px-6 py-2.5 rounded font-medium text-sm hover:bg-brand-light transition-colors duration-200"
          >
            Retry Analysis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <span className="text-xs font-semibold tracking-widest text-brand uppercase">Step 2 of 4</span>
        <h1 className="text-3xl font-bold tracking-tight text-black mt-1">Gap Analysis</h1>
        <p className="text-gray-500 mt-2 text-sm">
          We compared your resume with the job requirements. Review the areas of improvement below.
        </p>
      </div>

      {analysisResult && (
        <div className="space-y-8">
          {/* Missing Keywords Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest text-gray-400">Missing Keywords</h3>
            {analysisResult.missing_keywords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {analysisResult.missing_keywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="inline-block bg-gray-100 text-black text-xs font-medium px-3 py-1 rounded"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No missing keywords identified.</p>
            )}
          </div>

          {/* Missing Skills Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest text-gray-400">Missing Skills</h3>
            {analysisResult.missing_skills.length > 0 ? (
              <ul className="space-y-2 list-disc pl-5 text-sm text-gray-700">
                {analysisResult.missing_skills.map((skill, idx) => (
                  <li key={idx}>{skill}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">No missing skills identified.</p>
            )}
          </div>

          {/* Weak Sections Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest text-gray-400">Weak Sections</h3>
            {analysisResult.weak_sections.length > 0 ? (
              <div className="space-y-4">
                {analysisResult.weak_sections.map((item, idx) => (
                  <div key={idx} className="border-l-2 border-brand/20 pl-4 py-1">
                    <h4 className="text-sm font-semibold text-brand">{item.section}</h4>
                    <p className="text-sm text-gray-600 mt-1">{item.issue}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No weak sections identified.</p>
            )}
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row gap-4 sm:gap-0 justify-between items-center text-center sm:text-left">
        <button
          onClick={() => navigate('/upload')}
          className="text-xs font-medium text-gray-500 hover:text-black transition-colors duration-200 cursor-pointer w-full sm:w-auto"
        >
          Back to Upload
        </button>
        <button
          onClick={() => navigate('/review')}
          className="bg-brand text-white px-8 py-3 rounded font-semibold text-sm hover:bg-brand-light transition-all duration-200 shadow-subtle w-full sm:w-auto cursor-pointer"
        >
          Tailor My Resume
        </button>
      </div>
    </div>
  );
};
