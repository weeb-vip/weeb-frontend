import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {faLock, faArrowLeft, faCheckCircle, faUser, faEnvelope} from '@fortawesome/free-solid-svg-icons';
import { useMutation } from '@tanstack/react-query';
import Button, { ButtonColor, StatusType } from '../../components/Button/Button';
import FormInput from '../../components/FormInput';
import { resetPassword } from '../../services/queries';
import { ResetPasswordInput } from '../../gql/graphql';

const PasswordReset: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  const { mutate: mutateResetPassword, isLoading } = useMutation({
    ...resetPassword(),
    onSuccess: (response: boolean) => {
      if (response) {
        setResetComplete(true);
        // Redirect to home after showing success message
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        setErrorMessage('Failed to reset password. Please try again.');
      }
    },
    onError: (error: any) => {
      console.error('Password reset failed:', error);
      let errorMsg = 'Failed to reset password. Please try again.';

      if (error.message.includes('token')) {
        errorMsg = 'Invalid or expired reset token. Please request a new password reset.';
      } else if (error.message.includes('password')) {
        errorMsg = error.message;
      }

      setErrorMessage(errorMsg);
    }
  });

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    const emailParam = searchParams.get('email');

    if (!tokenParam) {
      setErrorMessage('Invalid or missing reset token. Please request a new password reset.');
      return;
    }

    if (!emailParam) {
      setErrorMessage('Invalid or missing email. Please request a new password reset.');
      return;
    }

    setToken(tokenParam);
    setEmail(emailParam);
  }, [searchParams]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  const validatePassword = () => {
    if (formData.newPassword.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (formData.newPassword !== formData.confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validatePassword();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (!token || !email) {
      setErrorMessage('Invalid reset token or email. Please request a new password reset.');
      return;
    }

    setErrorMessage('');
    mutateResetPassword({
      input: {
        token: token,
        newPassword: formData.newPassword,
        username: email
      }
    });
  };

  // Show error state if no token
  if (!token && !searchParams.get('token')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
              <FontAwesomeIcon icon={faLock} className="text-red-600 dark:text-red-400 text-xl" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Invalid Reset Link
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              This password reset link is invalid or has expired.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            <Link
              to="/auth/password-reset-request"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Request New Reset Link
            </Link>
            <Link
              to="/"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show success state
  if (resetComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <FontAwesomeIcon icon={faCheckCircle} className="text-green-600 dark:text-green-400 text-xl" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Password Reset Complete
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Your password has been successfully reset. You can now log in with your new password.
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
              Redirecting you to the home page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <FontAwesomeIcon icon={faLock} className="text-blue-600 dark:text-blue-400 text-xl" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900 dark:text-gray-100">
            Set new password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Enter your new password below
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <FormInput
              id="email"
              name="email"
              type="text"
              value={email}
              onChange={() => {}} // No-op since it's disabled
              placeholder="Email"
              label="Email"
              icon={faEnvelope}
              disabled={true}
            />

            <FormInput
              id="newPassword"
              name="newPassword"
              type="password"
              value={formData.newPassword}
              onChange={handleInputChange}
              placeholder="New password (min. 8 characters)"
              label="New Password"
              icon={faLock}
              required
              showPasswordToggle
              onPasswordToggle={() => setShowPassword(!showPassword)}
              isPasswordVisible={showPassword}
            />

            <FormInput
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Confirm new password"
              label="Confirm New Password"
              icon={faLock}
              required
              showPasswordToggle
              onPasswordToggle={() => setShowConfirmPassword(!showConfirmPassword)}
              isPasswordVisible={showConfirmPassword}
            />
          </div>

          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            </div>
          )}

          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p>Password requirements:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>At least 8 characters long</li>
              <li>Both passwords must match</li>
            </ul>
          </div>

          <div>
            <Button
              color={ButtonColor.blue}
              label="Reset Password"
              onClick={() => {}}
              showLabel
              status={isLoading ? 'loading' : 'idle'}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md"
            />
          </div>

          <div className="text-center">
            <Link
              to="/"
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordReset;
