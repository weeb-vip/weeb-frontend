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
import React, { useState} from "react";
import Autocomplete from "../Autocomplete";

function Header() {

  const flags = useFlags(['algolia_search']);
  const navigate = useNavigate()
  // @ts-ignore
  return (
    <>
      <div className="flex flex-row items-center justify-between p-2 bg-white-800 border-b border-gray-200">
        <div className="flex flex-row items-center space-x-4">
          <Link to={"/"}>
            <div className="flex flex-row items-center justify-center">
              <img src="https://cdn.weeb.vip/images/logo6-rev-sm_sm.png" alt="logo" style={{width: '60px', height: '60px'}}/>
            </div>
          </Link>
          <span className="text-xl font-normal">Anime</span>
        </div>
        <div className="flex flex-row items-center space-x-4">
          {!flags.algolia_search.enabled ? (
            <Search<searchResult>
              searchFunction={api.search.search}
              className="relative w-72 z-10"
              parseSearchResult={(item: searchResult) => item.name}
              mapFunction={
                (selectItem) => (item: searchResult) => (
                  <div onClick={() => {
                    selectItem(item)
                    navigate(`/show/${item.type}/${item.anidbid}`)
                  }}
                       className="flex flex-row items-center space-x-2 p-2"
                  >
                    <img
                      src={`${(global as any).config.api_host}/show/anime/${item.id.split('-')[0].toLowerCase()}/${item.id.replace(/[^0-9.]/gm, '')}/poster`}
                      alt={item.name}
                      style={{height: '50px'}}
                      className={"aspect-2/3 m-2"}
                    />
                    <div className={"flex flex-col flex-shrink"}>
                      <span>{item.name}</span>
                      <span>{item.year}</span>
                    </div>
                  </div>
                )
              }/>
          ) : (
            <div className={'relative'}>
              <Autocomplete

              />
            </div>


            //   <InstantSearch searchClient={searchClient} indexName="instant_search">
            //   <SearchBox
            //     className="searchbox"
            //     translations={{
            //       placeholder: '',
            //     }}
            //   />
            // </InstantSearch>
          )}
          <Button color={ButtonColor.blue} showLabel={true} label={"Login"} onClick={() => {
          }} icon={null}/>
          <Button color={ButtonColor.transparent} showLabel={true} label={"Register"} onClick={() => {
          }} icon={null}/>
        </div>
      </div>
    </>
  )
}


export {Header as default}
