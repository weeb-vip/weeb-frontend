import React, {useRef, useMemo, useEffect, useState} from "react";
import algoliasearch from "algoliasearch/lite";
import {createAutocomplete, AutocompleteOptions} from "@algolia/autocomplete-core";
import {getAlgoliaResults} from "@algolia/autocomplete-preset-algolia";
import {faSearch} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {useNavigate} from "react-router-dom";
import {isValid} from "date-fns";
import Item from "./item";

const searchClient = algoliasearch("A2HF2P5C6X", "45216ed5ac3f9e0a478d3c354d353d58");

export function Autocomplete() {
  const navigate = useNavigate();

  const [autocompleteState, setAutocompleteState] = useState<any>({});
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const mobileFormRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  const desktopInputRef = useRef<HTMLInputElement>(null);
  const desktopFormRef = useRef<HTMLDivElement>(null);
  const desktopPanelRef = useRef<HTMLDivElement>(null);

  const autocomplete = useMemo(() => {
    return createAutocomplete({
      onStateChange({state}) {
        setAutocompleteState(state);
      },
      getSources() {
        return [
          {
            sourceId: "data",
            getItemInputValue({item}) {
              return item.title_en;
            },
            getItems({query}) {
              return getAlgoliaResults({
                searchClient,
                queries: [
                  {
                    indexName: "anime",
                    query,
                    params: {
                      hitsPerPage: 20,
                    },
                  },
                ],
              });
            },
          },
        ];
      },
    } as AutocompleteOptions<any>);
  }, []);

  const inputProps = autocomplete.getInputProps({
    inputElement: desktopInputRef.current,
    onFocus: () => {
      autocomplete.setIsOpen(true);
    },
    onBlur: () => {
      autocomplete.setIsOpen(false);
    },
  });

  const {getEnvironmentProps} = autocomplete;

  useEffect(() => {
    if (!mobileFormRef.current || !mobileInputRef.current || !mobilePanelRef.current) return;

    const {onTouchStart, onTouchMove, onMouseDown} = getEnvironmentProps({
      formElement: mobileFormRef.current,
      inputElement: mobileInputRef.current,
      panelElement: mobilePanelRef.current,
    });

    window.addEventListener("touchstart", onTouchStart);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("mousedown", onMouseDown);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [getEnvironmentProps]);

  const renderPanel = (panelRef: React.RefObject<HTMLDivElement>, inputRef: React.RefObject<HTMLInputElement>) =>
    autocompleteState.isOpen && (
      <>
        {/* @ts-ignore */}
        <div
          className="absolute z-50 bg-white dark:bg-gray-800 w-full left-0 right-0 max-h-60 overflow-auto shadow-md mt-1 rounded-md transition-colors duration-300"
          {...autocomplete.getPanelProps({})}
          ref={panelRef}
        >
          {autocompleteState.collections.map((collection: any, index: number) => (
            <ul key={index} {...autocomplete.getListProps()}>
              {collection.items
                .filter((item: any) => isValid(new Date(item.start_date)))
                .map((item: any) => (
                  <Item
                    key={item.objectID}
                    item={item}
                    source={collection.source}
                    navigate={navigate}
                    autocomplete={autocomplete}
                    inputRef={inputRef}
                  />
                ))}
            </ul>
          ))}
        </div>
      </>
    );

  return (
    <>

        <div
          className={`
        fixed inset-0 z-40 bg-white/30 dark:bg-gray-900/30 backdrop-blur-md
    transition-opacity duration-300 ease-in-out
      ${autocompleteState.isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}
    `}
          onClick={() => {
            desktopInputRef.current?.blur();
            mobileInputRef.current?.blur();
          }}
        />

      {/* Mobile: inline search bar */}
      <div className="relative w-full sm:hidden z-50 focus-within:shadow-xl rounded-full transition-all duration-300 ease-in-out">
        <div
          className="w-full relative"
          {...autocomplete.getRootProps({})}
          ref={mobileFormRef}
        >
          <FontAwesomeIcon
            icon={faSearch}
            className="absolute top-0 bottom-0 left-4 m-auto text-gray-500 dark:text-gray-400"
          />
          {/* @ts-ignore */}
          <input
            className="w-full rounded-full py-2 px-3 pl-10 text-base leading-5 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 outline-none border border-gray-200 dark:border-gray-600 focus:border-gray-400 dark:focus:border-gray-500 transition-colors duration-300"
            {...inputProps}
            ref={mobileInputRef}
          />
          {renderPanel(mobilePanelRef, mobileInputRef)}
        </div>
      </div>

      {/* Desktop: floating, always-visible search */}

      <div
        className={`
          hidden sm:flex z-50 left-1/2 -translate-x-1/2 w-full max-w-xl
          top-0
          focus-within:top-16
          bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-full
          transition-all duration-300 ease-in-out
          shadow-sm focus-within:shadow-xl
          scale-100 focus-within:scale-105
          relative
        `}
        {...autocomplete.getRootProps({})}
        ref={desktopFormRef}
      >
        <FontAwesomeIcon
          icon={faSearch}
          className="absolute top-0 bottom-0 left-4 m-auto text-gray-500"
        />
        {/* @ts-ignore */}
        <input
          ref={desktopInputRef}
          className="w-full rounded-full py-2 px-4 pl-10 text-base border border-gray-200 dark:border-gray-600 outline-none focus:border-gray-400 dark:focus:border-gray-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 transition-colors duration-300"
          {...inputProps}
        />
        <div className="absolute top-50 left-0 right-0 mt-10">
          {renderPanel(desktopPanelRef, desktopInputRef)}
        </div>
      </div>
    </>
  );
}
