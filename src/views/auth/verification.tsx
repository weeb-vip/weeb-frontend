import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import debug from '../../utils/debug';
import { verifyEmail } from '../../services/queries';

interface VerificationState {
  loading: boolean;
  success: boolean;
  error: string | null;
}

export default function EmailVerification() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<VerificationState>({
    loading: false,
    success: false,
    error: null
  });

  const email = searchParams.get('email');
  const token = searchParams.get('token');

  const verifyEmailMutation = useMutation({
    ...verifyEmail(token || ''),
    onSuccess: () => {
      setState({
        loading: false,
        success: true,
        error: null
      });
    },
    onError: (error: any) => {
      debug.error('Email verification failed', error);
      setState({
        loading: false,
        success: false,
        error: 'The verification token may be invalid or have expired. Please request a new verification email.'
      });
    }
  });

  useEffect(() => {
    if (!email || !token) {
      setState({
        loading: false,
        success: false,
        error: 'Invalid verification link. Missing email or token.'
      });
      return;
    }

    // Auto-start verification when component mounts
    setState(prev => ({ ...prev, loading: true }));
    verifyEmailMutation.mutate();
  }, [email, token]);

  const handleRetry = () => {
    if (token) {
      setState(prev => ({ ...prev, loading: true, error: null }));
      verifyEmailMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <img
              className="h-12 w-auto"
              src="/assets/logo.png"
              alt="Weeb VIP"
              onError={({ currentTarget }) => {
                currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Email Verification
          </h2>
          {email && (
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              Verifying email address: <span className="font-medium">{decodeURIComponent(email)}</span>
            </p>
          )}
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
            {state.loading && (
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  Verifying your email address...
                </p>
              </div>
            )}

            {state.success && (
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
                  <svg
                    className="h-6 w-6 text-green-600 dark:text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                  Email Verified Successfully!
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Your email address has been verified. You can now log in to your account.
                </p>
                <div className="mt-6">
                  <Link
                    to="/login"
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                  >
                    Go to Login
                  </Link>
                </div>
              </div>
            )}

            {state.error && (
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900">
                  <svg
                    className="h-6 w-6 text-red-600 dark:text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                  Verification Failed
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {state.error}
                </p>
                <div className="mt-6 space-y-3">
                  {token && (
                    <button
                      onClick={handleRetry}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                    >
                      Try Again
                    </button>
                  )}
                  <Link
                    to="/login"
                    className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                  >
                    Back to Login
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}