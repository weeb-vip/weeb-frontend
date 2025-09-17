import React, { useState } from 'react';
import { useNavigate } from '../../utils/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faLock, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import Button, { ButtonColor } from '../../components/Button/Button';
import FormInput from '../../components/FormInput';
import { useLogin } from '../../hooks/useLogin';
import { type LoginInput } from '../../gql/graphql';
import { useLoggedInStore } from '../../services/globalstore';
import debug from '../../utils/debug';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const setLoggedIn = useLoggedInStore((state) => state.setLoggedIn);
  const [formData, setFormData] = useState<LoginInput>({
    username: '',
    password: ''
  });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);

  const { mutate: mutateLogin, isLoading } = useLogin(
    (response) => {
      if (response?.Credentials?.token) {
        debug.auth('Login successful');

        // Store the auth token in localStorage
        localStorage.setItem('authToken', response.Credentials.token);

        // Update the logged-in state in Zustand store
        setLoggedIn();

        // Navigate to home page
        navigate('/');
      } else {
        setErrorMessage('Login failed. Invalid response from server.');
      }
    },
    (error: any) => {
      debug.error('Login failed', error);
      let errorMsg = 'Login failed. Please try again.';

      if (error.message.includes('Invalid credentials') || error.message.includes('authentication')) {
        errorMsg = 'Invalid username or password. Please check your credentials and try again.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMsg = 'Network error. Please check your connection and try again.';
      } else if (error.message) {
        errorMsg = error.message;
      }

      setErrorMessage(errorMsg);
    }
  );

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

    if (!formData.username.trim() || !formData.password.trim()) {
      setErrorMessage('Please fill in all fields.');
      return;
    }

    setErrorMessage('');
    mutateLogin({ input: formData });
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
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Welcome back! Please enter your credentials.
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
              placeholder="Email"
              label="Email"
              icon={faUser}
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
              required
              showPasswordToggle
              onPasswordToggle={() => setShowPassword(!showPassword)}
              isPasswordVisible={showPassword}
            />
          </div>

          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm space-y-1">
              <div>
                <a
                  href="/auth/password-reset-request"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
                >
                  Forgot your password?
                </a>
              </div>
              <div>
                <a
                  href="/auth/resend-verification"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
                >
                  Resend email verification
                </a>
              </div>
            </div>
          </div>

          <div>
            <Button
              color={ButtonColor.blue}
              label="Sign In"
              onClick={() => {}}
              showLabel
              status={isLoading ? 'loading' : 'idle'}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md"
            />
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <a
                href="/auth/register"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
              >
                Sign up here
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

export default Login;
