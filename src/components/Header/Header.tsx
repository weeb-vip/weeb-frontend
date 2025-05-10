import Button, {ButtonColor} from "../Button";
import Search from "../Search";
import {searchResult} from "../../services/api/search";
import api from "../../services/api";
import {Link, useNavigate} from "react-router-dom";
import {useFlags} from "flagsmith/react";
import {autocomplete, getAlgoliaResults} from '@algolia/autocomplete-js';
import {
  InstantSearch,
  Configure,
  Hits,
  SearchBox,
  Panel,
  RefinementList,
  Pagination,
  Highlight, connectSearchBox, Snippet,
} from 'react-instantsearch-dom';
import algoliasearch from "algoliasearch/lite";
import React, {useState} from "react";
import Autocomplete from "../Autocomplete";
import {useLoggedInStore, useLoginModalStore} from "../../services/globalstore";

function Header() {
  // @ts-ignore
  const loggedIn = useLoggedInStore((state) => state.isLoggedIn);
  const flags = useFlags(['algolia_search']);
  const navigate = useNavigate()
  // @ts-ignore
  const openModalLogin = useLoginModalStore((state) => state.openLogin);
  // @ts-ignore
  const openModalRegister = useLoginModalStore((state) => state.openRegister);
  // @ts-ignore
  return (
    <>
      <div className="flex flex-row items-center justify-between p-2 bg-white-800 border-b border-gray-200">
        <div className="flex flex-row items-center space-x-4">
          <Link to={"/"}>
            <div className="flex flex-row items-center justify-center">
              <img src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png" alt="logo"
                   style={{width: '60px', height: '60px'}}/>
            </div>
          </Link>
          <span className="text-xl font-normal">Anime</span>
        </div>
        <div className="flex flex-row items-center space-x-4">

          <div className={'relative'}>
            <Autocomplete

            />
          </div>

          {!loggedIn ? (<>
          <Button color={ButtonColor.blue} showLabel={true} label={"Login"} onClick={() => {
            openModalLogin()
          }} icon={null}/>
          <Button color={ButtonColor.transparent} showLabel={true} label={"Register"} onClick={() => {
            openModalRegister()
          }} icon={null}/>
          </>) : (<>
            <Link to={"/profile"}>
              <Button color={ButtonColor.blue} showLabel={true} label={"Profile"} onClick={() => {
              }} icon={null}/>
            </Link>
            <Button color={ButtonColor.transparent} showLabel={true} label={"Logout"} onClick={() => {
              localStorage.removeItem("authToken");
              localStorage.removeItem("refreshToken");
              // @ts-ignore
              useLoggedInStore.getState().logout();
              navigate("/")
            }} icon={null}/>
          </>)}
        </div>
      </div>
    </>
  )
}


export {Header as default}
