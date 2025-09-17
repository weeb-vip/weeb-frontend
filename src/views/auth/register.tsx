import React, { useState } from 'react';
import { useNavigate } from '../../utils/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faLock, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { useMutation } from '@tanstack/react-query';
import Button, { ButtonColor } from '../../components/Button/Button';
import FormInput from '../../components/FormInput';
import { register } from '../../services/queries';
import { type RegisterInput } from '../../gql/graphql';
import debug from '../../utils/debug';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<RegisterInput & { confirmPassword: string }>({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { mutate: mutateRegister, isLoading } = useMutation({
    ...register(),
    onSuccess: (response) => {
      debug.success('Registration successful!', response);
      setErrorMessage('');
      setSuccessMessage('Registration successful! Please check your email to verify your account before logging in.');
      setFormData({ username: '', password: '', confirmPassword: '' });
    },
    onError: (error: any) => {
      debug.error('Registration failed', error);
      let errorMsg = 'Registration failed. Please try again.';

      if (error.message.includes('already exists') || error.message.includes('exists')) {
        errorMsg = 'An account with this email already exists. Please try logging in or use a different email.';
      } else if (error.message.includes('invalid email') || error.message.includes('email')) {
        errorMsg = 'Please enter a valid email address.';
      } else if (error.message.includes('password')) {
        errorMsg = 'Password requirements not met. Please ensure it\'s at least 6 characters long.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMsg = 'Network error. Please check your connection and try again.';
      } else if (error.message) {
        errorMsg = error.message;
      }

      setErrorMessage(errorMsg);
      setSuccessMessage('');
    }
  });

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.username.trim()) {
      errors.username = 'Email is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Email must be at least 3 characters';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
    // Clear messages
    if (errorMessage) {
      setErrorMessage('');
    }
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    const data: RegisterInput = { username: formData.username, password: formData.password };
    mutateRegister({ input: data });
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
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Join Weeb VIP to track your anime journey
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
              error={validationErrors.username}
              required
            />

            <FormInput
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Password"
              label="Password"
              icon={faLock}
              error={validationErrors.password}
              required
            />

            <FormInput
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Confirm password"
              label="Confirm password"
              icon={faLock}
              error={validationErrors.confirmPassword}
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
              <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Register'
              )}
            </button>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <a
                href="/auth/login"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
              >
                Sign in here
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

export default Register;