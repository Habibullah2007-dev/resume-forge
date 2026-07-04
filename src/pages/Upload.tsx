import React, { useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import type { AppContextType } from '../types';
import { extractTextFromPdf, extractTextFromDocx } from '../utils/extractor';

export const Upload: React.FC = () => {
  const navigate = useNavigate();
  const {
    resumeFile,
    setResumeFile,
    jobDescriptionText,
    setJobDescriptionText,
    supportingFiles,
    setSupportingFiles,
    setResumeText,
    setSupportingText,
  } = useOutletContext<AppContextType>();

  const [dragOverResume, setDragOverResume] = useState(false);
  const [dragOverSupport, setDragOverSupport] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const resumeInputRef = useRef<HTMLInputElement>(null);
  const supportInputRef = useRef<HTMLInputElement>(null);

  const isValidFile = (file: File) => {
    const name = file.name.toLowerCase();
    return name.endsWith('.pdf') || name.endsWith('.docx');
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    const name = file.name.toLowerCase();
    
    // For mock files generated in-memory during testing/demos, read directly as text
    if (file.name === 'test_resume.pdf' || file.name === 'test_cert.docx') {
      return await file.text();
    }

    if (name.endsWith('.pdf')) {
      return await extractTextFromPdf(file);
    } else if (name.endsWith('.docx')) {
      return await extractTextFromDocx(file);
    }
    throw new Error('Unsupported file format');
  };

  const handleAnalyzeClick = async () => {
    if (!resumeFile || jobDescriptionText.trim() === '') return;

    setIsExtracting(true);
    setExtractionError(null);
    setErrorMsg(null);

    try {
      // 1. Extract Resume Text
      let resText = '';
      try {
        resText = await extractTextFromFile(resumeFile);
      } catch (err) {
        console.error(err);
        throw new Error(`Failed to parse resume "${resumeFile.name}". Please ensure it is not corrupt.`);
      }

      // 2. Extract Supporting Documents (combined string)
      let combinedSupportingText = '';
      const failedFiles: string[] = [];

      for (const file of supportingFiles) {
        try {
          const text = await extractTextFromFile(file);
          combinedSupportingText += `=== Document: ${file.name} ===\n${text}\n\n`;
        } catch (err) {
          console.error(err);
          failedFiles.push(file.name);
        }
      }

      if (failedFiles.length > 0) {
        // Show inline warning for failed files, but proceed
        setErrorMsg(`Gracefully skipped files that failed to read: ${failedFiles.join(', ')}.`);
      }

      setResumeText(resText);
      setSupportingText(combinedSupportingText.trim());

      // Navigate to step 2 (Analyze)
      navigate('/analyze');
    } catch (err: any) {
      setExtractionError(err.message || 'An error occurred while reading your files.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Resume drag & drop
  const handleResumeDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragOverResume(true);
    } else if (e.type === 'dragleave') {
      setDragOverResume(false);
    }
  };

  const handleResumeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverResume(false);
    setErrorMsg(null);
    setExtractionError(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (isValidFile(file)) {
        setResumeFile(file);
      } else {
        setErrorMsg('Only .pdf and .docx files are accepted for the resume.');
      }
    }
  };

  const handleResumeSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setExtractionError(null);
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (isValidFile(file)) {
        setResumeFile(file);
      } else {
        setErrorMsg('Only .pdf and .docx files are accepted for the resume.');
      }
    }
  };

  // Supporting files drag & drop
  const handleSupportDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragOverSupport(true);
    } else if (e.type === 'dragleave') {
      setDragOverSupport(false);
    }
  };

  const handleSupportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSupport(false);
    setErrorMsg(null);
    setExtractionError(null);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(isValidFile);
    
    if (validFiles.length < files.length) {
      setErrorMsg('Some files were ignored. Only .pdf and .docx supporting files are allowed.');
    }
    
    if (validFiles.length > 0) {
      setSupportingFiles([...supportingFiles, ...validFiles]);
    }
  };

  const handleSupportSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setExtractionError(null);
    const files = e.target.files ? Array.from(e.target.files) : [];
    const validFiles = files.filter(isValidFile);
    
    if (validFiles.length < files.length) {
      setErrorMsg('Some files were ignored. Only .pdf and .docx supporting files are allowed.');
    }

    if (validFiles.length > 0) {
      setSupportingFiles([...supportingFiles, ...validFiles]);
    }
  };

  const removeResume = () => {
    setResumeFile(null);
    if (resumeInputRef.current) resumeInputRef.current.value = '';
  };

  const removeSupportFile = (index: number) => {
    const newFiles = [...supportingFiles];
    newFiles.splice(index, 1);
    setSupportingFiles(newFiles);
  };

  const handleLoadTestData = () => {
    const dummyResume = new File(
      ["Senior React Developer with 5 years experience. Skills: React, TypeScript, Tailwind CSS, Vite, Jest, Node.js."],
      "test_resume.pdf",
      { type: "application/pdf" }
    );
    const dummyCert = new File(
      ["AWS Certified Solutions Architect. Passed June 2026."],
      "test_cert.docx",
      { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
    );
    
    setResumeFile(dummyResume);
    setJobDescriptionText("We are looking for a Senior Frontend Engineer who has expert knowledge of React, TypeScript, and Tailwind CSS. Experience with build tools like Vite and bundler configurations is required.");
    setSupportingFiles([dummyCert]);
  };

  const isFormValid = resumeFile !== null && jobDescriptionText.trim() !== '';

  if (isExtracting) {
    return (
      <div className="space-y-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">Forge Your Tailored Resume</h1>
          <p className="text-gray-500 mt-2 text-sm max-w-[550px]">Reading and extracting text from your documents...</p>
        </div>

        <div className="space-y-6">
          <div className="h-28 w-full bg-gray-100 animate-pulse rounded-lg border border-gray-200"></div>
          <div className="h-40 w-full bg-gray-100 animate-pulse rounded-lg border border-gray-200"></div>
          <div className="h-28 w-full bg-gray-100 animate-pulse rounded-lg border border-gray-200"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black">Forge Your Tailored Resume</h1>
        <p className="text-gray-500 mt-2 text-sm max-w-[550px]">
          Upload your resume and provide the target job description. We will tailor your experience to match the role.
        </p>
      </div>

      {extractionError && (
        <div className="p-4 bg-red-50 border-l-2 border-red-600 text-red-800 text-xs font-medium rounded-r">
          {extractionError}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-yellow-50 border-l-2 border-yellow-600 text-yellow-800 text-xs font-medium rounded-r">
          {errorMsg}
        </div>
      )}

      <div className="space-y-6">
        {/* Section 1: Main Resume Upload */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">
            1. Current Resume <span className="text-brand">*</span>
          </label>
          
          <input
            type="file"
            ref={resumeInputRef}
            onChange={handleResumeSelect}
            accept=".pdf,.docx"
            className="hidden"
          />

          {!resumeFile ? (
            <div
              onDragEnter={handleResumeDrag}
              onDragOver={handleResumeDrag}
              onDragLeave={handleResumeDrag}
              onDrop={handleResumeDrop}
              onClick={() => resumeInputRef.current?.click()}
              className={`border rounded-lg p-10 text-center cursor-pointer transition-all duration-200 ${
                dragOverResume 
                  ? 'border-brand bg-brand/5' 
                  : 'border-gray-200 hover:border-gray-400 bg-white'
              }`}
            >
              <div className="space-y-2">
                <p className="text-sm font-medium text-black">Drag and drop your resume here</p>
                <p className="text-xs text-gray-400">PDF or Word format (.pdf, .docx)</p>
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between bg-gray-50">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-black truncate">{resumeFile.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatSize(resumeFile.size)}</p>
              </div>
              <button
                onClick={removeResume}
                className="text-xs font-semibold text-gray-500 hover:text-black ml-4 py-1 px-2 border border-gray-200 rounded bg-white transition-colors duration-200"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Job Description Textarea */}
        <div className="space-y-2">
          <label htmlFor="jd-textarea" className="block text-xs font-bold text-gray-500 uppercase tracking-widest">
            2. Job Description <span className="text-brand">*</span>
          </label>
          <textarea
            id="jd-textarea"
            rows={10}
            value={jobDescriptionText}
            onChange={(e) => setJobDescriptionText(e.target.value)}
            placeholder="Paste the target job description (responsibilities, required skills, etc.) here..."
            className="w-full border border-gray-200 rounded-lg p-4 text-sm focus:outline-none focus:border-brand transition-colors duration-200 resize-y text-black placeholder-gray-400 bg-white"
          />
        </div>

        {/* Section 3: Supporting Documents (Optional) */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">
            3. Supporting Documents <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <p className="text-xs text-gray-400 mb-2">
            Attach certifications, credentials, portfolio text, or reference letters.
          </p>

          <input
            type="file"
            ref={supportInputRef}
            onChange={handleSupportSelect}
            accept=".pdf,.docx"
            multiple
            className="hidden"
          />

          <div
            onDragEnter={handleSupportDrag}
            onDragOver={handleSupportDrag}
            onDragLeave={handleSupportDrag}
            onDrop={handleSupportDrop}
            onClick={() => supportInputRef.current?.click()}
            className={`border rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
              dragOverSupport 
                ? 'border-brand bg-brand/5' 
                : 'border-gray-200 hover:border-gray-400 bg-white'
            }`}
          >
            <div className="space-y-2">
              <p className="text-sm font-medium text-black">Drag and drop additional files</p>
              <p className="text-xs text-gray-400">PDF or Word format (.pdf, .docx). Select multiple if needed.</p>
            </div>
          </div>

          {supportingFiles.length > 0 && (
            <ul className="border border-gray-100 rounded-lg divide-y divide-gray-100 mt-3">
              {supportingFiles.map((file, idx) => (
                <li key={idx} className="p-3 flex items-center justify-between bg-gray-50 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-700 truncate">{file.name}</p>
                    <p className="text-gray-400 mt-0.5">{formatSize(file.size)}</p>
                  </div>
                  <button
                    onClick={() => removeSupportFile(idx)}
                    className="text-gray-400 hover:text-red-600 ml-4 font-semibold px-2 py-1"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="border-t border-gray-100 pt-6 flex flex-col sm:flex-row gap-4 sm:gap-0 justify-between items-center text-center sm:text-left">
        <button
          onClick={handleLoadTestData}
          type="button"
          className="text-xs font-medium text-gray-400 hover:text-brand underline underline-offset-4 transition-colors duration-200 cursor-pointer"
        >
          Load Demo Data
        </button>
        <button
          onClick={handleAnalyzeClick}
          disabled={!isFormValid}
          className={`px-8 py-3 rounded font-semibold text-sm transition-all duration-200 w-full sm:w-auto ${
            isFormValid
              ? 'bg-brand text-white hover:bg-brand-light cursor-pointer shadow-subtle'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Analyze
        </button>
      </div>
    </div>
  );
};
