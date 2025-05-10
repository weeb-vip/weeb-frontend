import {useLoggedInStore, useLoginModalStore} from "./services/globalstore";
import React, {useEffect} from "react";
import {TokenRefresher} from "./services/token_refresher";
import {refreshTokenSimple} from "./services/queries";
import LoginRegisterModal from "./components/LoginRegisterModal";
import Modal from "./components/Modal";

const AuthHandler = () => {
  // @ts-ignore
  const loggedIn = useLoggedInStore((state) => state.isLoggedIn);
  // @ts-ignore
  const setLoggedIn = useLoggedInStore((state) => state.setLoggedIn);
  // @ts-ignore
  const setLogout = useLoggedInStore((state) => state.logout);
  // @ts-ignore
  const modalOpen = useLoginModalStore((state) => state.isOpen);
  // @ts-ignore
  const close = useLoginModalStore((state) => state.close);
  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("refreshToken");
    setLogout();

  }
  // check localstorage for login token
  useEffect(() => {
    const authToken = localStorage.getItem("authToken");
    console.log(authToken);
    if (authToken) {
      setLoggedIn(true);
      // @ts-ignore
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