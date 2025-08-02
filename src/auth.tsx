import {useLoggedInStore, useLoginModalStore} from "./services/globalstore";
import React, {useEffect} from "react";
import {TokenRefresher} from "./services/token_refresher";
import {refreshTokenSimple} from "./services/queries";
import LoginRegisterModal from "./components/LoginRegisterModal";
import Modal from "./components/Modal";
import debug from "./utils/debug";

const AuthHandler = () => {
  const loggedIn = useLoggedInStore((state) => state.isLoggedIn);
  const setLoggedIn = useLoggedInStore((state) => state.setLoggedIn);
  const setLogout = useLoggedInStore((state) => state.logout);
  const modalOpen = useLoginModalStore((state) => state.isOpen);
  const close = useLoginModalStore((state) => state.close);
  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("refreshToken");
    setLogout();

  }
  // check localstorage for login token
  useEffect(() => {
    const authToken = localStorage.getItem("authToken");
    debug.auth("Checking stored auth token:", authToken ? "Token found" : "No token");
    if (authToken) {
      setLoggedIn();
      TokenRefresher.getInstance(refreshTokenSimple).start(authToken); // Start token refresh process
    }

  }, []);

  return (
    <Modal title={""} isOpen={modalOpen} closeFn={close}>
      <LoginRegisterModal closeFn={close}/>
    </Modal>
  )
}

export default AuthHandler