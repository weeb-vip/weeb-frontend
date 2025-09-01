import React, { Fragment, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/free-solid-svg-icons";
import { Link, useNavigate } from "react-router-dom";
import { useLoggedInStore, useLoginModalStore } from "../../services/globalstore";
import Autocomplete from "../Autocomplete";
import Button, { ButtonColor } from "../Button";
import DarkModeToggle from "../DarkModeToggle";

/* ---------------------------- Wordmark bits ---------------------------- */

export function WeebMorphLogo({
                                wordSize = "text-2xl md:text-3xl",
                                colorClass = "bg-gray-800 dark:bg-gray-300",
                              }: { wordSize?: string; colorClass?: string }) {
  const [on, setOn] = useState(false);
  return (
    <span
      className="relative inline-grid group/logo select-none whitespace-nowrap flex-shrink-0"
      onClick={() => setOn(v => !v)}
      aria-pressed={on}
      role="button"
    >
      <span
        className={[
          "col-start-1 row-start-1 font-light text-transparent bg-clip-text text-center",
          colorClass, wordSize, "tracking-[0.18em]",
          "transition-all duration-300 ease-out",
          on ? "opacity-0 -translate-y-1" : "opacity-100 translate-y-0",
          "group-hover/logo:opacity-0 group-hover/logo:-translate-y-1",
        ].join(" ")}
      >
        WEEB
      </span>
      <span
        lang="ja"
        className={[
          "col-start-1 row-start-1 font-light text-transparent bg-clip-text text-center",
          colorClass, wordSize, "tracking-normal",
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
      <WeebMorphLogo wordSize={wordSize} colorClass="bg-gray-800 dark:bg-gray-300" />
      <span className="inline-flex items-center gap-3 px-3 sm:px-4 py-1.5 rounded-2xl dark:bg-slate-900/80 ring-1 ring-slate-700">
        <span className={`dark:text-slate-50 font-black font-light tracking-[0.35em] ${vipSize}`}>VIP</span>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
      </span>
    </div>
  );
}

/* -------------------------- Utility: lock scroll -------------------------- */
function BodyScrollLock({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [active]);
  return null;
}

/* -------------------------------- Header -------------------------------- */

function Header() {
  const loggedIn = useLoggedInStore(s => s.isLoggedIn);
  const navigate = useNavigate();
  const openLogin = useLoginModalStore(s => s.openLogin);
  const openRegister = useLoginModalStore(s => s.openRegister);

  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 transition-colors duration-300">
      {/* Mobile */}
      <div className="flex sm:hidden w-full items-center space-x-4">
        <Link to="/"><img src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png" alt="logo" className="w-10 h-10" /></Link>
        <div className="flex-grow"><Autocomplete /></div>
        <button className="p-4" aria-label="Open menu" onClick={() => setDrawerOpen(true)}>
          <FontAwesomeIcon icon={faBars} className="text-gray-700 dark:text-gray-300 text-xl" />
        </button>

        {/* Drawer */}
        <Transition show={drawerOpen} as={Fragment} appear>
          <Dialog as="div" className="relative z-50" onClose={setDrawerOpen}>
            <BodyScrollLock active={drawerOpen} />

            {/* Backdrop */}
            <Transition.Child
              as={Fragment}
              appear
              enter="transition-opacity duration-300 ease-out"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity duration-300 ease-in"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/40" />
            </Transition.Child>

            {/* Sliding panel container (right anchored) */}
            <div className="fixed inset-0 overflow-hidden">
              <div className="absolute inset-0 flex justify-end">
                {/* Only this child gets the transform classes */}
                <Transition.Child
                  as={Fragment}
                  appear
                  enter="transform-gpu will-change-transform transition duration-300 ease-out"
                  enterFrom="translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform-gpu will-change-transform transition duration-300 ease-in"
                  leaveFrom="translate-x-0"
                  leaveTo="translate-x-full"
                >
                  {/* Panel is fixed & right-anchored; NO extra transition/transform here */}
                  <Dialog.Panel className="pointer-events-auto fixed right-0 inset-y-0 w-full bg-white dark:bg-gray-900 p-8 flex flex-col justify-between">
                    {/* Close */}
                    <div className="flex justify-end">
                      <button
                        className="text-2xl font-bold text-gray-700 dark:text-gray-300"
                        onClick={() => setDrawerOpen(false)}
                        aria-label="Close menu"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col justify-start space-y-4">
                      <div className="flex items-center space-x-4">
                        <img src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png" alt="logo" className="w-10 h-10" />
                        <WeebVipWordmark size="sm" />
                      </div>

                      <div className="flex items-center justify-between px-4 py-4 rounded">
                        <span className="text-lg text-gray-900 dark:text-gray-100">Dark Mode</span>
                        <DarkModeToggle />
                      </div>

                      {!loggedIn ? (
                        <>
                          <button
                            onClick={() => { setDrawerOpen(false); openLogin(); }}
                            className="w-full text-left px-4 py-4 rounded text-lg text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Login
                          </button>
                          <button
                            onClick={() => { setDrawerOpen(false); openRegister(); }}
                            className="w-full text-left px-4 py-4 rounded text-lg text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Register
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            to="/profile"
                            onClick={() => setDrawerOpen(false)}
                            className="block w-full text-left px-4 py-4 rounded text-lg text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Profile
                          </Link>
                          <button
                            onClick={() => {
                              localStorage.removeItem("authToken");
                              localStorage.removeItem("refreshToken");
                              useLoggedInStore.getState().logout();
                              setDrawerOpen(false);
                              navigate("/");
                            }}
                            className="w-full text-left px-4 py-4 rounded text-lg text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Logout
                          </button>
                        </>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="text-center py-4 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-xs text-gray-400 dark:text-gray-500">Version {__APP_VERSION__}</span>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>

      {/* Desktop */}
      <div className="hidden sm:flex flex-row items-center justify-between space-x-4 mt-4 sm:mt-0">
        <div className="flex items-center space-x-4">
          <Link to="/" className="flex flex-row space-x-4">
            <img src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png" alt="logo" className="w-14 h-14" />
            <WeebVipWordmark />
          </Link>
        </div>
        <div className="flex-grow max-w-md"><Autocomplete /></div>
        <div className="flex items-center space-x-4">
          <DarkModeToggle />
          {!loggedIn ? (
            <>
              <Button color={ButtonColor.blue} label="Login" onClick={openLogin} showLabel />
              <Button color={ButtonColor.transparent} label="Register" onClick={openRegister} showLabel />
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
