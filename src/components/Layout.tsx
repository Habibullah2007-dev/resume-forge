import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { AppContextType, AnalysisResult } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const Layout: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const location = useLocation();
  const navigate = useNavigate();

  // App State to share across wizard pages
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescriptionText, setJobDescriptionText] = useState<string>('');
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [resumeText, setResumeText] = useState<string>('');
  const [supportingText, setSupportingText] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [tailoredSummary, setTailoredSummary] = useState<string>('');
  const [tailoredSkills, setTailoredSkills] = useState<string>('');
  const [tailoredExperience, setTailoredExperience] = useState<string>('');

  const { session, user, signOut } = useAuth();

  const currentPath = location.pathname;
  let currentStep = 1;
  if (currentPath === '/analyze') currentStep = 2;
  else if (currentPath === '/review') currentStep = 3;
  else if (currentPath === '/export') currentStep = 4;

  const resetFlow = () => {
    setResumeFile(null);
    setJobDescriptionText('');
    setSupportingFiles([]);
    setResumeText('');
    setSupportingText('');
    setAnalysisResult(null);
    setTailoredSummary('');
    setTailoredSkills('');
    setTailoredExperience('');
    navigate('/upload');
  };

  const contextValue: AppContextType = {
    resumeFile,
    setResumeFile,
    jobDescriptionText,
    setJobDescriptionText,
    supportingFiles,
    setSupportingFiles,
    resumeText,
    setResumeText,
    supportingText,
    setSupportingText,
    analysisResult,
    setAnalysisResult,
    tailoredSummary,
    setTailoredSummary,
    tailoredSkills,
    setTailoredSkills,
    tailoredExperience,
    setTailoredExperience,
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-black font-sans antialiased">
      {/* Top Header */}
      <header className="border-b border-gray-100 py-6 px-6">
        <div className="max-w-[700px] mx-auto w-full">
          <div className="flex justify-between items-center">
            <span 
              onClick={() => navigate('/')} 
              className="text-xl font-bold tracking-tight text-brand cursor-pointer"
            >
              ResumeForge
            </span>
            <div className="flex items-center space-x-6">
              {/* Step Indicators */}
              {location.pathname !== '/login' && (
                <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[10px] sm:text-xs font-semibold text-gray-400">
                  <span className={currentStep >= 1 ? "text-brand" : ""}>Upload</span>
                  <span className="hidden sm:inline">&middot;</span>
                  <span className={currentStep >= 2 ? "text-brand" : ""}>Analyze</span>
                  <span className="hidden sm:inline">&middot;</span>
                  <span className={currentStep >= 3 ? "text-brand" : ""}>Review</span>
                  <span className="hidden sm:inline">&middot;</span>
                  <span className={currentStep >= 4 ? "text-brand" : ""}>Export</span>
                </div>
              )}

              {/* Auth Controls */}
              {session ? (
                <div className="flex items-center space-x-4 text-xs">
                  {location.pathname !== '/history' ? (
                    <button
                      onClick={() => navigate('/history')}
                      className="text-xs font-semibold text-brand hover:text-brand-light underline underline-offset-4 cursor-pointer"
                    >
                      History
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate('/upload')}
                      className="text-xs font-semibold text-brand hover:text-brand-light underline underline-offset-4 cursor-pointer"
                    >
                      New Tailoring
                    </button>
                  )}
                  <span className="text-gray-200">|</span>
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="font-semibold text-black truncate max-w-[120px]">{user?.email}</span>
                  </div>
                  <div className="w-7 h-7 bg-brand/10 text-brand rounded-full flex items-center justify-center font-bold text-xs select-none">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <button
                    onClick={async () => {
                      await signOut();
                      navigate('/login');
                    }}
                    className="text-xs font-semibold text-gray-400 hover:text-brand underline underline-offset-4 cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                location.pathname !== '/login' && (
                  <button
                    onClick={() => navigate('/login')}
                    className="text-xs font-semibold text-brand hover:text-brand-light underline underline-offset-4 cursor-pointer"
                  >
                    Log In
                  </button>
                )
              )}
            </div>
          </div>
        </div>
        {/* Thin progress bar */}
        <div className="max-w-[700px] mx-auto w-full mt-4 bg-gray-100 h-1 rounded-full overflow-hidden">
          <div 
            className="bg-brand h-full transition-all duration-300 ease-out" 
            style={{ width: `${location.pathname === '/login' ? 0 : currentStep * 25}%` }}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-[700px] w-full mx-auto px-6 py-12 md:py-18">
        <Outlet context={contextValue} />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6 text-sm text-gray-400">
        <div className="max-w-[700px] mx-auto w-full flex justify-between items-center">
          <p>&copy; {currentYear} ResumeForge. All rights reserved.</p>
          {(resumeFile || jobDescriptionText) && (
            <button 
              onClick={resetFlow}
              className="text-xs font-semibold text-gray-400 hover:text-brand underline underline-offset-4 cursor-pointer transition-colors duration-200"
            >
              Start Over
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
