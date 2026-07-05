import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const from = location.state?.from?.pathname || '/upload';

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signInWithGoogle();
      // Since OAuth redirects the browser, loading state remains until redirect
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Failed to authenticate with Google.');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { data, error } = await signUpWithEmail(email, password);
        if (error) {
          setErrorMsg(error.message);
        } else {
          // Check if confirmation is required (session might be null if email confirmation is enabled)
          if (data?.session) {
            navigate(from, { replace: true });
          } else {
            setSuccessMsg('Sign up successful! Please check your email to verify your account.');
          }
        }
      } else {
        const { data, error } = await signInWithEmail(email, password);
        if (error) {
          setErrorMsg(error.message);
        } else if (data?.session) {
          navigate(from, { replace: true });
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[450px] mx-auto w-full my-10 p-8 border border-gray-200 rounded-xl bg-white shadow-subtle space-y-8 animate-fadeIn">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-black">
          {isSignUp ? 'Create an Account' : 'Welcome Back'}
        </h1>
        <p className="text-gray-500 text-sm">
          {isSignUp 
            ? 'Sign up to start tailoring your resume to job listings.' 
            : 'Sign in to access your tailored resumes and ATS checks.'}
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border-l-2 border-red-600 text-red-800 text-xs font-medium rounded-r">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-green-50 border-l-2 border-green-600 text-green-800 text-xs font-medium rounded-r">
          {successMsg}
        </div>
      )}

      <div className="space-y-4">
        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center space-x-3 px-6 py-3 border border-gray-200 hover:border-gray-400 bg-white rounded-lg text-sm font-semibold text-black transition-colors duration-200 cursor-pointer shadow-subtle"
        >
          {/* Google Icon SVG */}
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="flex items-center my-6">
          <hr className="w-full border-gray-100" />
          <span className="px-3 text-xs text-gray-400 font-semibold uppercase tracking-wider bg-white">or</span>
          <hr className="w-full border-gray-100" />
        </div>

        {/* Email / Password Auth */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-xs font-bold text-gray-500 uppercase tracking-widest">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-200 rounded-lg p-3.5 text-sm focus:outline-none focus:border-brand transition-colors duration-200 text-black bg-white placeholder-gray-400"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-xs font-bold text-gray-500 uppercase tracking-widest">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-lg p-3.5 text-sm focus:outline-none focus:border-brand transition-colors duration-200 text-black bg-white placeholder-gray-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-white hover:bg-brand-light px-8 py-3.5 rounded font-semibold text-sm transition-all duration-200 shadow-subtle cursor-pointer flex justify-center items-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              <span>{isSignUp ? 'Sign Up with Email' : 'Sign In'}</span>
            )}
          </button>
        </form>
      </div>

      <div className="text-center pt-2">
        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
          className="text-xs font-medium text-gray-500 hover:text-brand transition-colors duration-200 cursor-pointer underline underline-offset-4"
        >
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </button>
      </div>
    </div>
  );
};
