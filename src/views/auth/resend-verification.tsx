import React, { useState } from 'react';
import { useNavigate } from '../../utils/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faArrowLeft, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import Button, { ButtonColor } from '../../components/Button/Button';
import FormInput from '../../components/FormInput';
import { useResendVerificationEmail } from '../../hooks/useResendVerificationEmail';
import debug from '../../utils/debug';

const ResendVerification: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: ''
  });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const { mutate: mutateResendEmail, isLoading } = useResendVerificationEmail(
    (response) => {
      if (response) {
        debug.success('Verification email resent successfully');
        setSuccessMessage('Verification email sent! Please check your inbox and spam folder.');
        setErrorMessage('');
        setFormData({ username: '' });
      } else {
        setErrorMessage('Failed to send verification email. Please try again.');
      }
    },
    (error: any) => {
      debug.error('Failed to resend verification email', error);
      let errorMsg = 'Failed to send verification email. Please try again.';

      if (error.message.includes('User not found') || error.message.includes('not found')) {
        errorMsg = 'No account found with this email address. Please check and try again.';
      } else if (error.message.includes('already verified') || error.message.includes('verified')) {
        errorMsg = 'Your email is already verified. You can proceed to login.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMsg = 'Network error. Please check your connection and try again.';
      } else if (error.message) {
        errorMsg = error.message;
      }

      setErrorMessage(errorMsg);
      setSuccessMessage('');
    }
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear messages when user starts typing
    if (errorMessage) {
      setErrorMessage('');
    }
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.username)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    mutateResendEmail({ username: formData.username });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
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
            Resend Email Verification
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Enter your email address to receive a new verification link
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <FormInput
              id="username"
              name="username"
              type="email"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Email address"
              label="Email address"
              icon={faUser}
              required
            />
          </div>

          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
              <div className="flex items-center">
                <FontAwesomeIcon icon={faEnvelope} className="text-green-400 mr-2" />
                <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
              </div>
            </div>
          )}

          <div>
            <Button
              color={ButtonColor.blue}
              label="Send Verification Email"
              onClick={() => {}}
              showLabel
              status={isLoading ? 'loading' : 'idle'}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md"
            />
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already verified?{' '}
              <a
                href="/auth/login"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
              >
                Sign in here
              </a>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Need help?{' '}
              <a
                href="/auth/password-reset-request"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
              >
                Reset your password
              </a>
            </p>
            <a
              href="/"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors inline-flex items-center"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
              Back to Home
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResendVerification;
