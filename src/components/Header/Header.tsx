import React, { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import { Link, useNavigate } from "react-router-dom";
import { useFlags } from "flagsmith/react";
import { useLoggedInStore, useLoginModalStore } from "../../services/globalstore";
import Autocomplete from "../Autocomplete";
import Button, { ButtonColor } from "../Button";

function Header() {
  const loggedIn = useLoggedInStore((state) => state.isLoggedIn);
  const flags = useFlags(["algolia_search"]);
  const navigate = useNavigate();
  const openModalLogin = useLoginModalStore((state) => state.openLogin);
  const openModalRegister = useLoginModalStore((state) => state.openRegister);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 p-2">
      {/* Mobile Layout */}
      <div className="flex sm:hidden w-full items-center space-x-2">
        {/* Logo */}
        <Link to="/">
          <img
            src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png"
            alt="logo"
            className="w-10 h-10"
          />
        </Link>

        {/* Search */}
        <div className="flex-grow">
          <Autocomplete />
        </div>

        {/* Hamburger Menu */}
        <Menu as="div" className="relative">
          <Menu.Button className="p-2">
            <FontAwesomeIcon icon={faBars} className="text-gray-700 text-xl" />
          </Menu.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Menu.Items className="fixed inset-0 z-50 bg-white p-6 flex flex-col justify-start space-y-4">
              {/* Close Button */}
              <Menu.Item>
                {() => (
                  <button
                    className="self-end text-2xl font-bold"
                    onClick={() =>
                      document.activeElement &&
                      (document.activeElement as HTMLElement).blur()
                    }
                  >
                    ✕
                  </button>
                )}
              </Menu.Item>

              {/* Auth Items */}
              {!loggedIn ? (
                <>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={openModalLogin}
                        className={`w-full text-left px-4 py-2 rounded text-lg ${
                          active ? "bg-gray-100" : ""
                        }`}
                      >
                        Login
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={openModalRegister}
                        className={`w-full text-left px-4 py-2 rounded text-lg ${
                          active ? "bg-gray-100" : ""
                        }`}
                      >
                        Register
                      </button>
                    )}
                  </Menu.Item>
                </>
              ) : (
                <>
                  <Menu.Item>
                    {({ active }) => (
                      <Link
                        to="/profile"
                        className={`block w-full text-left px-4 py-2 rounded text-lg ${
                          active ? "bg-gray-100" : ""
                        }`}
                      >
                        Profile
                      </Link>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => {
                          localStorage.removeItem("authToken");
                          localStorage.removeItem("refreshToken");
                          useLoggedInStore.getState().logout();
                          navigate("/");
                        }}
                        className={`w-full text-left px-4 py-2 rounded text-lg ${
                          active ? "bg-gray-100" : ""
                        }`}
                      >
                        Logout
                      </button>
                    )}
                  </Menu.Item>
                </>
              )}
            </Menu.Items>
          </Transition>
        </Menu>
      </div>

      {/* Desktop Layout */}
      <div className="hidden sm:flex flex-row items-center justify-between space-x-4 mt-2 sm:mt-0">
        {/* Left: Logo + Title */}
        <div className="flex items-center space-x-4">
          <Link to="/">
            <img
              src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png"
              alt="logo"
              className="w-14 h-14"
            />
          </Link>
          <span className="text-xl font-normal">Anime</span>
        </div>

        {/* Middle: Search */}
        <div className="flex-grow max-w-md">
          <Autocomplete />
        </div>

        {/* Right: Auth Buttons */}
        <div className="flex items-center space-x-4">
          {!loggedIn ? (
            <>
              <Button color={ButtonColor.blue} label="Login" onClick={openModalLogin} showLabel />
              <Button
                color={ButtonColor.transparent}
                label="Register"
                onClick={openModalRegister}
                showLabel
              />
            </>
          ) : (
            <>
              <Link to="/profile">
                <Button color={ButtonColor.blue} label="Profile" onClick={() => {}} showLabel />
              </Link>
              <Button
                color={ButtonColor.transparent}
                label="Logout"
                onClick={() => {
                  localStorage.removeItem("authToken");
                  localStorage.removeItem("refreshToken");
                  useLoggedInStore.getState().logout();
                  navigate("/");
                }}
                showLabel
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export { Header as default };
