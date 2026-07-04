export interface AnalysisResult {
  missing_keywords: string[];
  missing_skills: string[];
  weak_sections: { section: string; issue: string }[];
}

export interface AppContextType {
  resumeFile: File | null;
  setResumeFile: (file: File | null) => void;
  jobDescriptionText: string;
  setJobDescriptionText: (text: string) => void;
  supportingFiles: File[];
  setSupportingFiles: (files: File[]) => void;
  resumeText: string;
  setResumeText: (text: string) => void;
  supportingText: string;
  setSupportingText: (text: string) => void;
  analysisResult: AnalysisResult | null;
  setAnalysisResult: (result: AnalysisResult | null) => void;
  tailoredSummary: string;
  setTailoredSummary: (text: string) => void;
  tailoredSkills: string;
  setTailoredSkills: (text: string) => void;
  tailoredExperience: string;
  setTailoredExperience: (text: string) => void;
}
