import React, {Fragment, useState} from "react";
import { Menu, Transition } from "@headlessui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import { Link, useNavigate } from "react-router-dom";
import { useFlags } from "flagsmith/react";
import { useLoggedInStore, useLoginModalStore } from "../../services/globalstore";
import Autocomplete from "../Autocomplete";
import Button, { ButtonColor } from "../Button";
import DarkModeToggle from "../DarkModeToggle";

export  function WeebMorphLogo({
                                        wordSize = "text-2xl md:text-3xl",
                                        colorClass = "bg-gray-800 dark:bg-gray-300",
                                      }: {
  wordSize?: string;
  colorClass?: string; // solid color (no gradient)
}) {
  const [on, setOn] = useState(false);

  return (
    <span
      className="relative inline-grid group/logo select-none whitespace-nowrap flex-shrink-0"
      onClick={() => setOn(v => !v)}     // tap to toggle on mobile
      aria-pressed={on}
      role="button"
    >
      {/* EN layer */}
      <span
        className={[
          "col-start-1 row-start-1 font-light text-transparent bg-clip-text text-center",
          colorClass,
          wordSize,
          "tracking-[0.18em]",
          "transition-all duration-300 ease-out",
          on ? "opacity-0 -translate-y-1" : "opacity-100 translate-y-0",
          "group-hover/logo:opacity-0 group-hover/logo:-translate-y-1",
        ].join(" ")}
      >
        WEEB
      </span>

      {/* JP layer */}
      <span
        lang="ja"
        className={[
          "col-start-1 row-start-1 font-light text-transparent bg-clip-text text-center",
          colorClass,
          wordSize,
          "tracking-normal",
          "transition-all duration-300 ease-out",
          on ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
          "group-hover/logo:opacity-100 group-hover/logo:translate-y-0",
        ].join(" ")}
      >
        ウィーブ
      </span>
    </span>
  );
}

function WeebVipWordmark({ size = "md", className = "" }: { size?: "sm" | "md"; className?: string }) {
  const wordSize = size === "sm" ? "text-2xl tracking-[0.25em]" : "text-4xl md:text-4xl tracking-[0.28em]";
  const vipSize  = size === "sm" ? "text-sm" : "text-normal md:text-normal";

  return (
    <div className={`inline-flex items-center gap-2 sm:gap-3 ${className}`} role="img" aria-label="WEEB VIP wordmark">
      {/* WEEB gradient */}
      <WeebMorphLogo
        wordSize={wordSize}
        colorClass="bg-gray-800 dark:bg-gray-300"
      />
      {/*<span*/}
      {/*  className={`font-light ${wordSize} text-transparent bg-clip-text dark:bg-gray-300 bg-gray-800 transition-all`}*/}
      {/*>*/}
      {/*  WEEB*/}
      {/*</span>*/}


      {/* VIP pill */}
      <span className="inline-flex items-center gap-3 px-3 sm:px-4 py-1.5 rounded-2xl  dark:bg-slate-900/80 ring-1 ring-slate-700 transition-all">
        <span className={`dark:text-slate-50 font-black font-light  tracking-[0.35em] ${vipSize}`}>VIP</span>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
      </span>
    </div>
  );
}

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
              <Menu.Item>
                <div className={`flex items-center space-x-4`}>
                <img
                  src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png"
                  alt="logo"
                  className="w-10 h-10"
                />
                <WeebVipWordmark size="sm"/>
                </div>
              </Menu.Item>
              {/* Dark Mode Toggle */}
              <Menu.Item>
                {({active}) => (
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
          <Link to="/" className={"flex flex-row space-x-4"}>
            <img
              src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png"
              alt="logo"
              className="w-14 h-14"
            />
            <WeebVipWordmark />
          </Link>
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
