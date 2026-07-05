import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { AppContextType } from '../types';

export const History: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const {
    setResumeFile,
    setResumeText,
    setJobDescriptionText,
    setAnalysisResult,
    setTailoredSummary,
    setTailoredSkills,
    setTailoredExperience,
  } = useOutletContext<AppContextType>();

  const [resumes, setResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!session) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('analyzed_resumes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResumes(data || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to fetch your history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [session]);

  const handleLoadResume = (item: any) => {
    // Populate app state context
    // We set a mock File object to pass Upload page form validation
    setResumeFile(new File([], 'Loaded_Resume.pdf'));
    setResumeText(item.resume_text);
    setJobDescriptionText(item.job_description);
    setAnalysisResult(item.analysis_result);
    setTailoredSummary(item.tailored_summary || '');
    setTailoredSkills(item.tailored_skills || '');
    setTailoredExperience(item.tailored_experience || '');

    // Navigate straight to the final export page where they can review & download
    navigate('/export');
  };

  const handleDeleteResume = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this resume from your history?')) return;

    try {
      const { error } = await supabase
        .from('analyzed_resumes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setResumes(resumes.filter(r => r.id !== id));
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to delete resume.');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-gray-500">Retrieving your tailored resumes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-black">Your Tailoring History</h1>
        <p className="text-gray-500 mt-2 text-sm max-w-[550px]">
          Access and reload previously tailored resumes and ATS checks associated with your account.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border-l-2 border-red-600 text-red-800 text-xs font-medium rounded-r">
          {errorMsg}
        </div>
      )}

      {resumes.length === 0 ? (
        <div className="border border-gray-200 border-dashed rounded-xl p-12 text-center bg-white space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-black">No resumes tailored yet</p>
            <p className="text-xs text-gray-400 max-w-[320px] mx-auto">
              Tailor your first resume to job listings to see it saved securely in your history.
            </p>
          </div>
          <button
            onClick={() => navigate('/upload')}
            className="bg-brand text-white px-6 py-2.5 rounded font-semibold text-sm hover:bg-brand-light transition-colors duration-200 shadow-subtle cursor-pointer"
          >
            Tailor a New Resume
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {resumes.map((item) => {
            const keywords = item.analysis_result?.missing_keywords || [];
            return (
              <div
                key={item.id}
                onClick={() => handleLoadResume(item)}
                className="border border-gray-200 hover:border-brand rounded-xl p-6 bg-white cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-black group-hover:text-brand transition-colors duration-200">
                      {item.resume_name}
                    </h3>
                    <button
                      onClick={(e) => handleDeleteResume(item.id, e)}
                      className="text-xs font-semibold text-gray-400 hover:text-red-600 px-2 py-1 border border-gray-200 hover:border-red-200 rounded bg-white transition-colors duration-200"
                    >
                      Delete
                    </button>
                  </div>
                  
                  <p className="text-xs text-gray-400">
                    Tailored on {formatDate(item.created_at)}
                  </p>

                  <p className="text-sm text-gray-600 line-clamp-2 italic">
                    &ldquo;{item.job_description}&rdquo;
                  </p>
                </div>

                {keywords.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Optimized Keywords
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {keywords.slice(0, 5).map((word: string, i: number) => (
                        <span
                          key={i}
                          className="bg-gray-100 text-black text-[10px] font-medium px-2.5 py-0.5 rounded-full"
                        >
                          {word}
                        </span>
                      ))}
                      {keywords.length > 5 && (
                        <span className="text-[10px] text-gray-400 font-semibold self-center ml-1">
                          +{keywords.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
