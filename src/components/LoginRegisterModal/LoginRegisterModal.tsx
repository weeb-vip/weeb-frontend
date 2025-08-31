import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faLock } from '@fortawesome/free-solid-svg-icons';
import { LoginInput, SigninResult } from "../../gql/graphql";
import {login, refreshTokenSimple, register} from "../../services/queries";
import { TokenRefresher } from "../../services/token_refresher";
import { useMutation } from "@tanstack/react-query";
import {useLoggedInStore, useLoginModalStore} from "../../services/globalstore";
import Loader from "../Loader";
import FormInput from "../FormInput";
import Button, { ButtonColor } from "../Button";
import debug from "../../utils/debug";

export interface LoginRegisterModalProps {
  closeFn?: () => void;
}

export default function LoginRegisterModal({ closeFn }: LoginRegisterModalProps) {
  const registerState = useLoginModalStore((state) => state.register);
  const [isRegisterState, setIsRegisterState] = useState(registerState);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "", // for registration validation
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const setLoggedIn = useLoggedInStore((state) => state.setLoggedIn);


  const { mutate: mutateLogin, isLoading: loginLoading } = useMutation<SigninResult>({
    ...login(),
    // @ts-ignore
    onSuccess: (response: SigninResult, _variables: LoginInput) => {
      localStorage.setItem("authToken", response.Credentials.token);
      localStorage.setItem("refreshToken", response.Credentials.refresh_token);
      setLoggedIn();
      TokenRefresher.getInstance(refreshTokenSimple).start(response.Credentials.token);
      setErrorMessage("");
      if (closeFn) {
        closeFn();
      }
    },
    onError: (error: any) => {
      debug.warn("Login failed. Please check your credentials.");
      setErrorMessage("Login failed. Please check your credentials and try again.");
    },
  });

  const { mutate: mutateRegister, isLoading: registerLoading } = useMutation({
    ...register(),
    onSuccess: (response) => {
      debug.success("Registration successful!", response);
      setErrorMessage("");
      // @ts-ignore
      mutateLogin({
        input: {
          username: formData.username,
          password: formData.password,
        },
      });
    },
    onError: (error: any) => {
      debug.warn("Registration failed");
      setErrorMessage("Registration failed. Please try again or choose a different username.");
    },
  });

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.username.trim()) {
      errors.username = "Username is required";
    } else if (formData.username.length < 3) {
      errors.username = "Username must be at least 3 characters";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (isRegisterState) {
      if (!formData.confirmPassword) {
        errors.confirmPassword = "Please confirm your password";
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: "" }));
    }
    // Clear global error message
    if (errorMessage) {
      setErrorMessage("");
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!isRegisterState) {
      const data: LoginInput = {username: formData.username, password: formData.password};
      // @ts-ignore
      mutateLogin({input: data});
    } else {
      debug.info("Registering user:", formData.username);
      const data: LoginInput = {username: formData.username, password: formData.password};
      // @ts-ignore
      mutateRegister({input: data});
    }
  };

  const isLoading = loginLoading || registerLoading;

  return (
    <div className="w-[360px] sm:w-[400px] mx-auto p-8 sm:p-10 transition-colors duration-300">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100 text-center">{!isRegisterState ? 'Login' : 'Register'}</h2>

      <div className="mb-4 flex items-center">
        {errorMessage && (
          <div className="w-full p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-full transition-colors duration-300">
            <p className="text-red-800 dark:text-red-200 text-sm text-center">{errorMessage}</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          id="username"
          name="username"
          type="text"
          value={formData.username}
          onChange={handleChange}
          placeholder={!isRegisterState ? 'Enter your email' : 'Enter your email'}
          label={!isRegisterState ? 'Email' : 'Email'}
          icon={faUser}
          error={validationErrors.username}
          required
        />

        <FormInput
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Enter your password"
          label="Password"
          icon={faLock}
          error={validationErrors.password}
          required
        />

        {isRegisterState && (
          <FormInput
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Enter your password again"
            label="Confirm Password"
            icon={faLock}
            error={validationErrors.confirmPassword}
            required
          />
        )}

        <Button
          color={ButtonColor.blue}
          label={!isRegisterState ? 'Login' : 'Register'}
          onClick={() => {}}
          showLabel
          status={isLoading ? 'loading' : 'idle'}
          className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md mt-6"
        />
      </form>

      {/* Password Reset Link - Only show in login mode */}
      {!isRegisterState && (
        <div className="mt-4 text-center">
          <Link
            to="/auth/password-reset-request"
            onClick={closeFn}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-300 focus:outline-none focus:underline"
          >
            Forgot your password?
          </Link>
        </div>
      )}

      {/*
      <hr className="mb-6" />

      <button className="w-full flex items-center justify-center gap-4 py-4 border rounded-full hover:bg-gray-100 transition">
        <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21.35 11.1H12v2.8h5.35c-.4 2.1-2.25 3.6-4.35 3.6a4.39 4.39 0 0 1-4.39-4.4 4.39 4.39 0 0 1 4.39-4.4c1.2 0 2.28.45 3.12 1.2l2.1-2.1A7.18 7.18 0 0 0 12 5.2c-3.97 0-7.2 3.23-7.2 7.2S8.03 19.6 12 19.6c3.78 0 6.95-2.88 7.35-6.5z"/>
        </svg>
        Sign in with Google
      </button>
      */}

      <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        {!isRegisterState ? "Don't have an account?" : "Already have an account?"}{' '}
        <button
          type="button"
          onClick={() => {
            setIsRegisterState(!isRegisterState);
            setErrorMessage("");
            setValidationErrors({});
          }}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors duration-300 focus:outline-none focus:underline"
        >
          {!isRegisterState ? 'Register' : 'Login'}
        </button>
      </div>
    </div>
  );
}
