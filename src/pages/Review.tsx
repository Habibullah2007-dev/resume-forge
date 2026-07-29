import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, Navigate } from 'react-router-dom';
import type { AppContextType } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const Review: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const {
    resumeText,
    supportingText,
    analysisResult,
    tailoredSummary,
    setTailoredSummary,
    tailoredSkills,
    setTailoredSkills,
    tailoredExperience,
    setTailoredExperience,
    setTailoredEducation,
    setTailoredCertifications,
    setTailoredAwards,
    supportingDocAdds,
    setSupportingDocAdds,
  } = useOutletContext<AppContextType>();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [verifiedCount, setVerifiedCount] = useState<number>(() => {
    return Number(localStorage.getItem('verifiedCount') || '0');
  });
  const [removedCount, setRemovedCount] = useState<number>(() => {
    return Number(localStorage.getItem('removedCount') || '0');
  });

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

  const runTailoring = async () => {
    if (!resumeText || !analysisResult) return;

    setIsLoading(true);
    setErrorMsg(null);

    const prompt = `
You are an expert ATS Resume Writer, Career Coach, and Resume Optimization Specialist.
Your task is to optimize and tailor the Professional Summary, Skills, and Experience sections of the candidate's resume to match the target job description based on the provided ATS Gap Analysis, while preserving the resume's internal structure and details.

You will also receive SUPPORTING_DOCUMENTS_TEXT containing additional documents the candidate has uploaded (certificates, transcripts, award letters, etc.). Extract all relevant information from these documents and merge them into the correct sections of the tailored resume:
- Certificates and credentials → Certifications section
- Academic transcripts or results → Education section
- Awards or recognition letters → Awards & Achievements section
- Skills or competencies mentioned → Technical or Soft Skills section
- Work experience references → Professional Experience section
Only include information that is clearly supported by the document text. Do not invent or infer qualifications not explicitly stated in the supporting documents.

ATS GAP ANALYSIS:
${JSON.stringify(analysisResult)}

ORIGINAL RESUME TEXT:
${resumeText}

SUPPORTING_DOCUMENTS_TEXT:
${supportingText || ''}

## PRIMARY RULES
1. Your responsibility is NOT to rewrite the resume from scratch, but to optimize the contents of the Professional Summary, Skills, and Experience sections.
2. Optimize only the content inside each of these sections to better match the target job description.
3. Natural keyword optimization: Naturally inject the missing keywords/skills from the Gap Analysis where truthful and relevant.
4. You may rephrase or reframe skills already present in the resume using terminology from the job description. You may NOT add any specific tool, technology, platform, or skill name that does not already appear, in some form, in the original resume or supporting documents — even if it appears in the missing_keywords or missing_skills list. The missing_skills list is informational only, showing what the role wants, not a list of things to claim the candidate has.
5. Merge relevant information from the supporting documents into the Certifications, Education, Awards & Achievements, Technical or Soft Skills, and Professional Experience sections. Only include information supported by the document text.
6. Keep the content ATS-friendly.

## STRUCTURE LOCK
- You must preserve the structure of the Professional Summary, Skills, and Experience sections.
- Do not merge them or delete them.
- Compare your output against the original sections. If any section was originally present, it must be optimized and present in the final output.

## OUTPUT FORMAT
Return ONLY valid JSON with this exact shape:
{
  "summary": "Rewritten professional summary text...",
  "skills": "Optimized skills list, separated by commas or newlines...",
  "experience": "Optimized work experience sections and bullet points...",
  "education": "Merged Education section content if modified/added from supporting documents, otherwise empty string",
  "certifications": "Merged Certifications section content if modified/added from supporting documents, otherwise empty string",
  "awards": "Merged Awards & Achievements section content if modified/added from supporting documents, otherwise empty string",
  "supporting_doc_adds": [
    "Brief description of what was detected in supporting documents and where it was placed (e.g., 'Added AWS Certified Solutions Architect to Certifications', 'Added Dean's List to Education')"
  ]
}

Ensure your response contains ONLY the JSON payload. Do NOT wrap it in markdown code fences, do not add trailing explanations, and do not add any text before or after the JSON.
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
        throw new Error('Empty response received from the tailoring server.');
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
        typeof parsedResult.summary !== 'string' ||
        typeof parsedResult.skills !== 'string' ||
        typeof parsedResult.experience !== 'string'
      ) {
        throw new Error('Server response schema was invalid. Please try again.');
      }

      // 1. Hard validation step to prevent fabricated skills
      const originalTextLower = resumeText.toLowerCase();
      const supportingTextLower = (supportingText || '').toLowerCase();
      let cleanSkills = parsedResult.skills;
      const removedTerms: string[] = [];
      const verifiedTerms: string[] = [];

      // Gather missing keywords and skills from gap analysis for reporting
      const missingKeywordsList = Array.from(new Set([
        ...(analysisResult.missing_keywords || []),
        ...(analysisResult.missing_skills || [])
      ]));

      // Function to check if a technical skill is supported by the original resume or supporting documents
      const isSkillSupported = (skill: string): boolean => {
        const sLower = skill.toLowerCase().trim();
        if (!sLower) return true;

        // Strip prefixes like "Technical:", "Technical Skills:", "Soft Skills:"
        const cleanSkillName = sLower
          .replace(/^(technical|soft)\s+skills?:/i, '')
          .trim();
        if (!cleanSkillName) return true;

        // Direct inclusion
        if (originalTextLower.includes(cleanSkillName) || supportingTextLower.includes(cleanSkillName)) return true;

        // Check if all major words (length > 2) are in the original resume or supporting docs
        const words = cleanSkillName.split(/[\s\/]+/).filter(w => w.length > 2);
        if (words.length > 0 && words.every(word => originalTextLower.includes(word) || supportingTextLower.includes(word))) {
          return true;
        }

        // Common variations or abbreviations
        if (cleanSkillName.includes('n8n') && (originalTextLower.includes('n8n') || supportingTextLower.includes('n8n'))) return true;
        if (cleanSkillName.includes('generative ai') && (originalTextLower.includes('generative ai') || supportingTextLower.includes('generative ai'))) return true;

        return false;
      };

      // Split the entire rewritten skills string by commas and newlines
      const skillItems = cleanSkills.split(/[\n,]+/).map((item: string) => item.trim()).filter(Boolean);
      const filteredSkillItems = skillItems.filter((item: string) => {
        const cleanItem = item.replace(/^(technical|soft)\s+skills?:/i, '').trim();
        if (isSkillSupported(cleanItem)) {
          for (const missing of missingKeywordsList) {
            if (cleanItem.toLowerCase().includes(missing.toLowerCase()) && !verifiedTerms.includes(missing)) {
              verifiedTerms.push(missing);
            }
          }
          return true;
        } else {
          console.info(`removed unverified skill: ${item}`);
          for (const missing of missingKeywordsList) {
            if (cleanItem.toLowerCase().includes(missing.toLowerCase()) && !removedTerms.includes(missing)) {
              removedTerms.push(missing);
            }
          }
          if (removedTerms.length === 0 || !removedTerms.some(r => item.toLowerCase().includes(r.toLowerCase()))) {
            removedTerms.push(item);
          }
          return false;
        }
      });
      cleanSkills = filteredSkillItems.join(', ');

      // Also clean the summary sentence by sentence
      let cleanSummary = parsedResult.summary;
      const sentences = cleanSummary.split(/(?<=[.!?])\s+/);
      const filteredSentences = sentences.filter((sentence: string) => {
        const sentenceLower = sentence.toLowerCase();
        for (const term of missingKeywordsList) {
          const termLower = term.toLowerCase().trim();
          if (sentenceLower.includes(termLower)) {
            if (!originalTextLower.includes(termLower) && !supportingTextLower.includes(termLower)) {
              console.info(`removed unverified skill from summary: ${term}`);
              if (!removedTerms.includes(term)) removedTerms.push(term);
              return false; // drop sentence
            } else {
              if (!verifiedTerms.includes(term)) verifiedTerms.push(term);
            }
          }
        }
        return true;
      });
      cleanSummary = filteredSentences.join(' ');

      setVerifiedCount(verifiedTerms.length);
      setRemovedCount(removedTerms.length);
      localStorage.setItem('verifiedCount', String(verifiedTerms.length));
      localStorage.setItem('removedCount', String(removedTerms.length));

      setTailoredSummary(cleanSummary);
      setTailoredSkills(cleanSkills);
      setTailoredExperience(parsedResult.experience);
      setTailoredEducation(parsedResult.education || '');
      setTailoredCertifications(parsedResult.certifications || '');
      setTailoredAwards(parsedResult.awards || '');
      setSupportingDocAdds(parsedResult.supporting_doc_adds || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to complete resume tailoring. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Automatically trigger tailoring if tailored data is empty
    if (resumeText && analysisResult && !tailoredSummary && !isLoading && !errorMsg) {
      runTailoring();
    }
  }, [resumeText, analysisResult, tailoredSummary]);

  // Protect route
  if (!resumeText) {
    return <Navigate to="/upload" replace />;
  }
  if (!analysisResult) {
    return <Navigate to="/analyze" replace />;
  }

  if (isLoading) {
    return (
      <div className="space-y-10">
        <div>
          <span className="text-xs font-semibold tracking-widest text-brand uppercase">Step 3 of 4</span>
          <h1 className="text-3xl font-bold tracking-tight text-black mt-1">Review Revisions</h1>
          <p className="text-gray-500 mt-2 text-sm">Tailoring your resume content...</p>
        </div>

        <div className="space-y-8">
          {/* Section 1 Skeleton */}
          <div className="space-y-2">
            <div className="h-3.5 w-32 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-24 w-full bg-gray-100 animate-pulse rounded-lg border border-gray-200"></div>
          </div>

          {/* Section 2 Skeleton */}
          <div className="space-y-2">
            <div className="h-3.5 w-32 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-28 w-full bg-gray-100 animate-pulse rounded-lg border border-gray-200"></div>
          </div>

          {/* Section 3 Skeleton */}
          <div className="space-y-2">
            <div className="h-3.5 w-32 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-48 w-full bg-gray-100 animate-pulse rounded-lg border border-gray-200"></div>
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="space-y-6">
        <div className="p-4 bg-red-50 border-l-2 border-red-600 text-red-800 rounded-r text-sm">
          <p className="font-semibold">Tailoring Failed</p>
          <p className="mt-1 text-xs">{errorMsg}</p>
        </div>
        <div className="flex justify-between">
          <button
            onClick={() => navigate('/analyze')}
            className="border border-gray-200 text-gray-600 px-6 py-2.5 rounded font-medium text-sm hover:bg-gray-50 transition-colors duration-200"
          >
            Back to Gaps
          </button>
          <button
            onClick={runTailoring}
            className="bg-brand text-white px-6 py-2.5 rounded font-medium text-sm hover:bg-brand-light transition-colors duration-200"
          >
            Retry Tailoring
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <span className="text-xs font-semibold tracking-widest text-brand uppercase">Step 3 of 4</span>
        <h1 className="text-3xl font-bold tracking-tight text-black mt-1">Review Revisions</h1>
        <p className="text-gray-500 mt-2 text-sm">
          Review and tweak the tailored sections of your resume. Edits are editable before export.
        </p>
      </div>

      {(verifiedCount > 0 || removedCount > 0) && (
        <div className="p-4 bg-blue-50/50 border border-blue-100 text-blue-900 rounded-lg text-sm animate-fadeIn">
          <p className="font-semibold text-blue-800">Skills Tailoring Summary</p>
          <p className="mt-1 text-xs text-blue-700/95">
            {verifiedCount} skills were added by reframing existing experience. {removedCount} terms from the job description were NOT included because they weren't supported by your original resume.
          </p>
        </div>
      )}

      <div className="space-y-8">
        {/* Section 1: Professional Summary */}
        <div className="space-y-2">
          <label htmlFor="tailored-summary" className="block text-xs font-bold text-gray-500 uppercase tracking-widest text-gray-400">
            Professional Summary
          </label>
          <textarea
            id="tailored-summary"
            rows={5}
            value={tailoredSummary}
            onChange={(e) => setTailoredSummary(e.target.value)}
            className="w-full border border-gray-200 rounded-lg p-4 text-sm focus:outline-none focus:border-brand transition-colors duration-200 resize-y text-black bg-white"
          />
        </div>

        {/* Section 2: Skills */}
        <div className="space-y-2">
          <label htmlFor="tailored-skills" className="block text-xs font-bold text-gray-500 uppercase tracking-widest text-gray-400">
            Skills & Expertise
          </label>
          <textarea
            id="tailored-skills"
            rows={6}
            value={tailoredSkills}
            onChange={(e) => setTailoredSkills(e.target.value)}
            className="w-full border border-gray-200 rounded-lg p-4 text-sm focus:outline-none focus:border-brand transition-colors duration-200 resize-y text-black bg-white"
          />
        </div>

        {/* Section 3: Experience */}
        <div className="space-y-2">
          <label htmlFor="tailored-experience" className="block text-xs font-bold text-gray-500 uppercase tracking-widest text-gray-400">
            Work Experience
          </label>
          <textarea
            id="tailored-experience"
            rows={12}
            value={tailoredExperience}
            onChange={(e) => setTailoredExperience(e.target.value)}
            className="w-full border border-gray-200 rounded-lg p-4 text-sm focus:outline-none focus:border-brand transition-colors duration-200 resize-y text-black bg-white"
          />
        </div>
      </div>

      {/* Supporting Documents Extraction Summary */}
      {supportingDocAdds && supportingDocAdds.length > 0 && (
        <div className="p-4 bg-green-50/50 border border-green-100 text-green-900 rounded-lg text-sm animate-fadeIn space-y-2">
          <p className="font-semibold text-green-800">From your supporting documents, we added:</p>
          <ul className="list-disc pl-5 text-xs text-green-700/95 space-y-1">
            {supportingDocAdds.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Footer */}
      <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row gap-4 sm:gap-0 justify-between items-center text-center sm:text-left">
        <button
          onClick={() => navigate('/analyze')}
          className="text-xs font-medium text-gray-500 hover:text-black transition-colors duration-200 cursor-pointer w-full sm:w-auto"
        >
          Back to Gaps
        </button>
        <button
          onClick={() => navigate('/export')}
          className="bg-brand text-white px-8 py-3 rounded font-semibold text-sm hover:bg-brand-light transition-all duration-200 shadow-subtle w-full sm:w-auto cursor-pointer"
        >
          Check ATS Formatting
        </button>
      </div>
    </div>
  );
};
