import { useState } from 'react';
import { LoginInput, SigninResult } from "../../gql/graphql";
import {login, refreshTokenSimple, register} from "../../services/queries";
import { TokenRefresher } from "../../services/token_refresher";
import { useMutation } from "@tanstack/react-query";
import {useLoggedInStore, useLoginModalStore} from "../../services/globalstore";
import FoxgirlLoader from "../Loader/FoxgirlLoader";
import {mutationRegister} from "../../services/api/graphql/queries";

export interface LoginRegisterModalProps {
  closeFn?: () => void;
}

export default function LoginRegisterModal({ closeFn }: LoginRegisterModalProps) {
  // @ts-ignore
  const registerState = useLoginModalStore((state) => state.register);
  // @ts-ignore
  const [isRegisterState, setIsRegisterState] = useState(registerState);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "", // for registration validation
  });

  // @ts-ignore
  const setLoggedIn = useLoggedInStore((state) => state.setLoggedIn);


  const { mutate: mutateLogin, isLoading, isError, data, error } = useMutation<SigninResult>({
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

  const { mutate: mutateRegister } = useMutation({
    ...register(),
    onSuccess: (response) => {
      console.log("Registration successful", response);
      // @ts-ignore
      mutateLogin({
        input: {
          username: formData.username,
          password: formData.password,
        },
      });
    },
    onError: () => {
      console.log("Registration failed");
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };


  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isRegisterState) {
      const data: LoginInput = {username: formData.username, password: formData.password};
      // @ts-ignore
      mutateLogin({input: data});
    } else {
      if (formData.password !== formData.confirmPassword) {
        console.log("Passwords do not match");
        return;
      }
      // Handle registration logic here
      console.log("Registering user:", formData);
      const data: LoginInput = {username: formData.username, password: formData.password};
      // @ts-ignore
      mutateRegister({input: data});
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white">
      <h2 className="text-3xl font-semibold mb-6">{!isRegisterState ? 'Login' : 'Register'}</h2>

      <form onSubmit={handleSubmit}>


        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            name="username"
            type="text"
            value={formData.username}
            onChange={handleChange}
            placeholder={!isRegisterState ? 'Enter your username or email' : 'Enter your weeb username'}
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

        {isRegisterState && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Enter your password again"
              className="w-full px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}

        {isLoading && (
          <FoxgirlLoader/>)
        }
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 mb-6 text-white rounded-full bg-blue-500 hover:bg-blue-600 transition"
        >
          {!isRegisterState ? 'Login' : 'Register'}
        </button>
      </form>

      {/*
      <hr className="mb-6" />

      <button className="w-full flex items-center justify-center gap-2 py-2 border rounded-full hover:bg-gray-100 transition">
        <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21.35 11.1H12v2.8h5.35c-.4 2.1-2.25 3.6-4.35 3.6a4.39 4.39 0 0 1-4.39-4.4 4.39 4.39 0 0 1 4.39-4.4c1.2 0 2.28.45 3.12 1.2l2.1-2.1A7.18 7.18 0 0 0 12 5.2c-3.97 0-7.2 3.23-7.2 7.2S8.03 19.6 12 19.6c3.78 0 6.95-2.88 7.35-6.5z"/>
        </svg>
        Sign in with Google
      </button>
      */}

      <div className="mt-6 text-center text-sm text-gray-600">
        {!isRegisterState ? "Don't have an account?" : "Already have an account?"}{' '}
        <button
          type="button"
          onClick={() => setIsRegisterState(!isRegisterState)}
          className="text-blue-500 hover:underline"
        >
          {!isRegisterState ? 'Register' : 'Login'}
        </button>
      </div>
    </div>
  );
}
