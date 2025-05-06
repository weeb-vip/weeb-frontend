import { useState } from 'react';
import { LoginInput, SigninResult } from "../../gql/graphql";
import { login, refreshTokenSimple } from "../../services/queries";
import { TokenRefresher } from "../../services/token_refresher";
import { useMutation } from "@tanstack/react-query";
import { useLoggedInStore } from "../../services/globalstore";
import FoxgirlLoader from "../Loader/FoxgirlLoader";

export interface LoginRegisterModalProps {
  isLogin: boolean;
  closeFn?: () => void;
}

export default function LoginRegisterModal({ isLogin, closeFn }: LoginRegisterModalProps) {
  const [isLoginState, setIsLoginState] = useState(isLogin);
  // @ts-ignore
  const setLoggedIn = useLoggedInStore((state) => state.setLoggedIn);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const { mutate, isLoading, isError, data, error } = useMutation<SigninResult>({
    ...login(),
    // @ts-ignore
    onSuccess: (response: SigninResult, _variables: LoginInput) => {
      localStorage.setItem("authToken", response.Credentials.token);
      localStorage.setItem("refreshToken", response.Credentials.refresh_token);
      setLoggedIn(true);
      // @ts-ignore
      TokenRefresher.getInstance(refreshTokenSimple).start(response.Credentials.token);
      if (closeFn) {
        closeFn();
      }
    },
    onError: () => {
      console.log("Login failed. Please check your credentials.");
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data: LoginInput = { ...formData };
    // @ts-ignore
    mutate({ input: data });
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-2xl shadow-lg">
      <h2 className="text-3xl font-semibold mb-6">{isLoginState ? 'Login' : 'Register'}</h2>

      <form onSubmit={handleSubmit}>
        {!isLoginState && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              placeholder="Enter a valid email"
              className="w-full px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            name="username"
            type="text"
            value={formData.username}
            onChange={handleChange}
            placeholder={isLoginState ? 'Enter your username or email' : 'Enter your weeb username'}
            className="w-full px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter your password"
            className="w-full px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {!isLoginState && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              placeholder="Enter your password again"
              className="w-full px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}

        {isLoading && (
          <FoxgirlLoader />)
        }
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 mb-6 text-white rounded-full bg-blue-500 hover:bg-blue-600 transition"
        >
          {isLoginState ? 'Login' : 'Register'}
        </button>
      </form>

      <hr className="mb-6" />

      <button className="w-full flex items-center justify-center gap-2 py-2 border rounded-full hover:bg-gray-100 transition">
        <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21.35 11.1H12v2.8h5.35c-.4 2.1-2.25 3.6-4.35 3.6a4.39 4.39 0 0 1-4.39-4.4 4.39 4.39 0 0 1 4.39-4.4c1.2 0 2.28.45 3.12 1.2l2.1-2.1A7.18 7.18 0 0 0 12 5.2c-3.97 0-7.2 3.23-7.2 7.2S8.03 19.6 12 19.6c3.78 0 6.95-2.88 7.35-6.5z"/>
        </svg>
        Sign in with Google
      </button>

      <div className="mt-6 text-center text-sm text-gray-600">
        {isLoginState ? "Don't have an account?" : "Already have an account?"}{' '}
        <button
          type="button"
          onClick={() => setIsLoginState(!isLoginState)}
          className="text-blue-500 hover:underline"
        >
          {isLoginState ? 'Register' : 'Login'}
        </button>
      </div>
    </div>
  );
}
