import React, { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import { Link, useNavigate } from "react-router-dom";
import { useFlags } from "flagsmith/react";
import { useLoggedInStore, useLoginModalStore } from "../../services/globalstore";
import Autocomplete from "../Autocomplete";
import Button, { ButtonColor } from "../Button";
import DarkModeToggle from "../DarkModeToggle";

function Header() {
  const loggedIn = useLoggedInStore((state) => state.isLoggedIn);
  const flags = useFlags(["algolia_search"]);
  const navigate = useNavigate();
  const openModalLogin = useLoginModalStore((state) => state.openLogin);
  const openModalRegister = useLoginModalStore((state) => state.openRegister);

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 transition-colors duration-300">
      {/* Mobile Layout */}
      <div className="flex sm:hidden w-full items-center space-x-4">
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
          <Menu.Button className="p-4">
            <FontAwesomeIcon icon={faBars} className="text-gray-700 dark:text-gray-300 text-xl" />
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
            <Menu.Items className="fixed inset-0 z-50 bg-white dark:bg-gray-900 p-8 flex flex-col justify-start space-y-4 transition-colors duration-300">
              {/* Close Button */}
              <Menu.Item>
                {() => (
                  <button
                    className="self-end text-2xl font-bold text-gray-700 dark:text-gray-300"
                    onClick={() =>
                      document.activeElement &&
                      (document.activeElement as HTMLElement).blur()
                    }
                  >
                    ✕
                  </button>
                )}
              </Menu.Item>

              {/* Dark Mode Toggle */}
              <Menu.Item>
                {({ active }) => (
                  <div className={`flex items-center justify-between px-4 py-4 rounded ${
                    active ? "bg-gray-100 dark:bg-gray-700" : ""
                  }`}>
                    <span className="text-lg text-gray-900 dark:text-gray-100">Dark Mode</span>
                    <DarkModeToggle />
                  </div>
                )}
              </Menu.Item>

              {/* Auth Items */}
              {!loggedIn ? (
                <>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={openModalLogin}
                        className={`w-full text-left px-4 py-4 rounded text-lg text-gray-900 dark:text-gray-100 ${
                          active ? "bg-gray-100 dark:bg-gray-700" : ""
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
                        className={`w-full text-left px-4 py-4 rounded text-lg text-gray-900 dark:text-gray-100 ${
                          active ? "bg-gray-100 dark:bg-gray-700" : ""
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
                        className={`block w-full text-left px-4 py-4 rounded text-lg text-gray-900 dark:text-gray-100 ${
                          active ? "bg-gray-100 dark:bg-gray-700" : ""
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
                        className={`w-full text-left px-4 py-4 rounded text-lg text-gray-900 dark:text-gray-100 ${
                          active ? "bg-gray-100 dark:bg-gray-700" : ""
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
      <div className="hidden sm:flex flex-row items-center justify-between space-x-4 mt-4 sm:mt-0">
        {/* Left: Logo + Title */}
        <div className="flex items-center space-x-4">
          <Link to="/">
            <img
              src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png"
              alt="logo"
              className="w-14 h-14"
            />
          </Link>
          <span className="text-2xl font-thin tracking-wider text-gray-900 dark:text-gray-100">Weeb VIP</span>
        </div>

        {/* Middle: Search */}
        <div className="flex-grow max-w-md">
          <Autocomplete />
        </div>

        {/* Right: Dark Mode Toggle + Auth Buttons */}
        <div className="flex items-center space-x-4">
          <DarkModeToggle />
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
