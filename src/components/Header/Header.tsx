import Button, { ButtonColor } from "../Button";
import { Link, useNavigate } from "react-router-dom";
import { useFlags } from "flagsmith/react";
import React from "react";
import Autocomplete from "../Autocomplete";
import { useLoggedInStore, useLoginModalStore } from "../../services/globalstore";

function Header() {
  // @ts-ignore
  const loggedIn = useLoggedInStore((state) => state.isLoggedIn);
  const flags = useFlags(["algolia_search"]);
  const navigate = useNavigate();
  // @ts-ignore
  const openModalLogin = useLoginModalStore((state) => state.openLogin);
  // @ts-ignore
  const openModalRegister = useLoginModalStore((state) => state.openRegister);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 p-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        {/* Logo + Title */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Link to="/">
            <img
              src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png"
              alt="logo"
              className="w-10 h-10 sm:w-14 sm:h-14"
            />
          </Link>
          <span className="text-lg sm:text-xl font-normal">Anime</span>
        </div>

        {/* Search + Auth buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Autocomplete />
          </div>

          {!loggedIn ? (
            <>
              <Button
                color={ButtonColor.blue}
                showLabel={true}
                label={"Login"}
                onClick={() => openModalLogin()}
                icon={null}
              />
              <Button
                color={ButtonColor.transparent}
                showLabel={true}
                label={"Register"}
                onClick={() => openModalRegister()}
                icon={null}
              />
            </>
          ) : (
            <>
              <Link to="/profile">
                <Button
                  color={ButtonColor.blue}
                  showLabel={true}
                  label={"Profile"}
                  onClick={() => {}}
                  icon={null}
                />
              </Link>
              <Button
                color={ButtonColor.transparent}
                showLabel={true}
                label={"Logout"}
                onClick={() => {
                  localStorage.removeItem("authToken");
                  localStorage.removeItem("refreshToken");
                  // @ts-ignore
                  useLoggedInStore.getState().logout();
                  navigate("/");
                }}
                icon={null}
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export { Header as default };
