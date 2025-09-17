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
    debug.auth("Checking stored auth token:", authToken ? "Token found" : "No token");

    if (authToken) {
      // Validate token by making a simple request
      const validateToken = async () => {
        try {
          // Try to refresh the token - if it fails, the token is invalid
          const result = await refreshTokenSimple();
          if (result) {
            setLoggedIn();
            TokenRefresher.getInstance(refreshTokenSimple).start(authToken); // Start token refresh process
          } else {
            // Token is invalid
            debug.auth("Token validation failed, clearing tokens");
            AuthStorage.clearTokens();
            setLogout();
            setAuthInitialized();
          }
        } catch (error: any) {
          debug.auth("Token validation error:", error.message);
          // Token is invalid or network error
          AuthStorage.clearTokens();
          setLogout();
          setAuthInitialized();
        }
      };

      validateToken();
    } else {
      setAuthInitialized(); // Mark as initialized even if no token
    }

  }, []);

  return (
    <Modal title={""} isOpen={modalOpen} closeFn={close}>
      <LoginRegisterModal closeFn={close}/>
    </Modal>
  )
}

export default AuthHandler