import {useLoggedInStore, useLoginModalStore} from "./services/globalstore";
import React, {useEffect} from "react";
import {TokenRefresher} from "./services/token_refresher";
import {refreshTokenSimple} from "./services/queries";
import LoginRegisterModal from "./components/LoginRegisterModal";
import Modal from "./components/Modal";
import debug from "./utils/debug";
import {AuthStorage} from "./utils/auth-storage";

const AuthHandler = () => {
  const loggedIn = useLoggedInStore((state) => state.isLoggedIn);
  const setLoggedIn = useLoggedInStore((state) => state.setLoggedIn);
  const setLogout = useLoggedInStore((state) => state.logout);
  const setAuthInitialized = useLoggedInStore((state) => state.setAuthInitialized);
  const modalOpen = useLoginModalStore((state) => state.isOpen);
  const close = useLoginModalStore((state) => state.close);
  const logout = () => {
    AuthStorage.clearTokens();
    setLogout();
  }
  // check localstorage for login token and validate it
  useEffect(() => {
    const authToken = AuthStorage.getAuthToken();
    const refreshToken = AuthStorage.getRefreshToken();
    debug.auth("Checking stored tokens:", {
      authToken: authToken ? "Found" : "Missing",
      refreshToken: refreshToken ? "Found" : "Missing"
    });

    if (authToken || refreshToken) {
      // Validate and/or refresh the token
      const validateAndRefreshToken = async () => {
        try {
          // If we have a refresh token, try to refresh
          if (refreshToken) {
            debug.auth("Attempting to refresh token");
            const result = await refreshTokenSimple();

            if (result?.Credentials) {
              debug.success("Token refreshed successfully");
              setLoggedIn();

              // Start token refresher with the new token
              TokenRefresher.getInstance(refreshTokenSimple).start(result.Credentials.token);
              setAuthInitialized();
            } else {
              throw new Error("Invalid refresh response");
            }
          } else if (authToken) {
            // We only have auth token, no refresh token - this shouldn't happen
            // but we'll try to use it
            debug.warn("Auth token found but no refresh token");
            setLoggedIn();
            setAuthInitialized();
          }
        } catch (error: any) {
          debug.error("Token validation/refresh failed:", error.message);

          // Only clear tokens if refresh actually failed
          // Check if it's a real auth error vs network error
          const isAuthError = error.message?.toLowerCase().includes('unauthorized') ||
                             error.message?.toLowerCase().includes('invalid') ||
                             error.message?.toLowerCase().includes('expired') ||
                             error.message?.toLowerCase().includes('forbidden');

          if (isAuthError) {
            debug.auth("Authentication failed, clearing tokens");
            AuthStorage.clearTokens();
            setLogout();
          } else {
            debug.warn("Network or temporary error, keeping tokens for retry");
            // Still set as logged in to avoid logged out state on network issues
            if (authToken) {
              setLoggedIn();
            }
          }
          setAuthInitialized();
        }
      };

      validateAndRefreshToken();
    } else {
      debug.auth("No tokens found, user not logged in");
      setAuthInitialized(); // Mark as initialized even if no tokens
    }

  }, []);

  return (
    <Modal title={""} isOpen={modalOpen} closeFn={close}>
      <LoginRegisterModal closeFn={close}/>
    </Modal>
  )
}

export default AuthHandler