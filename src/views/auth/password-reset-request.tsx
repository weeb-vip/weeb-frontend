import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faUser, faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { useMutation } from "@tanstack/react-query";
import Button, { ButtonColor } from "../../components/Button/Button";
import FormInput from "../../components/FormInput";
import { requestPasswordReset } from "../../services/queries";
import { RequestPasswordResetInput } from "../../gql/graphql";

const PasswordResetRequest: React.FC = () => {
  const [formData, setFormData] = useState<RequestPasswordResetInput>({ username: "", email: "" });
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);

  // HARD BLOCK: once true, stays true until an error occurs
  const blockedRef = useRef(false);
  const [blocked, setBlocked] = useState(false);

  const mutation = useMutation({ ...requestPasswordReset() });

  // Swallow Enter/Space globally while blocked (captures before anything else)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!blockedRef.current) return;
      const k = e.key;
      if (k === "Enter" || k === " " || k === "Spacebar") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blockedRef.current || submitted) return;

    if (!formData.username.trim() || !formData.email.trim()) {
      setErrorMessage("Please fill in all fields");
      return;
    }

    setErrorMessage("");
    blockedRef.current = true;
    setBlocked(true);

    try {
      const ok = await mutation.mutateAsync({ input: formData });

      if (ok) {
        // Flip view synchronously; keep blocked = true (form is gone)
        flushSync(() => setSubmitted(true));
        return;
      }

      // Treat falsy as error → unblock to let user retry
      setErrorMessage("Failed to send password reset email. Please try again.");
      blockedRef.current = false;
      setBlocked(false);
    } catch (err: any) {
      console.error("Password reset request failed:", err);
      setErrorMessage(err?.message || "Failed to send password reset email. Please try again.");
      blockedRef.current = false;
      setBlocked(false);
    }
  };

  const disabled = blocked || submitted;

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <FontAwesomeIcon icon={faEnvelope} className="text-green-600 dark:text-green-400 text-xl" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Check your email</h2>
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
      <div className="max-w-md w-full space-y-8 relative">
        {/* Click/press guard overlay while blocked */}
        {blocked && <div className="absolute inset-0 z-10 bg-transparent" aria-hidden="true" />}

        <div>
          <div className="mx-auto h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <FontAwesomeIcon icon={faEnvelope} className="text-blue-600 dark:text-blue-400 text-xl" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900 dark:text-gray-100">Reset your password</h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Enter your username and email address to receive a password reset link
          </p>
        </div>

        <form
          className="mt-8 space-y-6 relative"
          onSubmit={handleSubmit}
          onKeyDownCapture={e => {
            if (blockedRef.current && e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          noValidate
        >
          {/* Disable whole form while blocked */}
          <fieldset
            disabled={disabled}
            aria-busy={blocked}
            className={disabled ? "opacity-60 pointer-events-none" : ""}
          >
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
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mt-4">
                <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
              </div>
            )}

            <div className="mt-4">
              <Button
                color={ButtonColor.blue}
                label={blocked ? "Sending…" : "Send Reset Link"}
                showLabel
                status={blocked ? "loading" : "idle"}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md"
                type="submit"
                disabled={disabled}
                aria-disabled={disabled}
              />
            </div>

            <div className="text-center mt-2">
              <Link
                to="/"
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
              >
                ← Back to Home
              </Link>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};

export default PasswordResetRequest;
