import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faUser, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { useMutation } from '@tanstack/react-query';
import Button, { ButtonColor } from '../../components/Button/Button';
import FormInput from '../../components/FormInput';
import { requestPasswordReset } from '../../services/queries';
import { RequestPasswordResetInput } from '../../gql/graphql';

const PasswordResetRequest: React.FC = () => {
  const [formData, setFormData] = useState<RequestPasswordResetInput>({
    username: '',
    email: ''
  });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);

  const { mutate: mutatePasswordReset, isLoading } = useMutation({
    ...requestPasswordReset(),
    onSuccess: (response: boolean) => {
      if (response) {
        setSubmitted(true);
      } else {
        setErrorMessage('Failed to send password reset email. Please try again.');
      }
    },
    onError: (error: any) => {
      console.error('Password reset request failed:', error);
      setErrorMessage(error.message || 'Failed to send password reset email. Please try again.');
    }
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.email.trim()) {
      setErrorMessage('Please fill in all fields');
      return;
    }

    setErrorMessage('');
    mutatePasswordReset({ input: formData });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <FontAwesomeIcon icon={faEnvelope} className="text-green-600 dark:text-green-400 text-xl" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Check your email
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              We've sent a password reset link to <strong>{formData.email}</strong>
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
              Please check your email and follow the instructions to reset your password.
            </p>
          </div>
          
          <div className="mt-8">
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <FontAwesomeIcon icon={faEnvelope} className="text-blue-600 dark:text-blue-400 text-xl" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900 dark:text-gray-100">
            Reset your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Enter your username and email address to receive a password reset link
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <FormInput
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Username"
              label="Username"
              icon={faUser}
              required
            />
            
            <FormInput
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Email address"
              label="Email address"
              icon={faEnvelope}
              required
            />
          </div>

          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            </div>
          )}

          <div>
            <Button
              color={ButtonColor.blue}
              label="Send Reset Link"
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

export default PasswordResetRequest;