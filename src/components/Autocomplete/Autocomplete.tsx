import React, {useRef, useMemo, useEffect, useState} from "react";
import algoliasearch from "algoliasearch/lite";
import {createAutocomplete, AutocompleteOptions} from "@algolia/autocomplete-core";
import {getAlgoliaResults} from "@algolia/autocomplete-preset-algolia";
import {faSearch} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {useNavigate} from "react-router-dom";
import {isValid} from "date-fns";
import Item from "./item";
import {versionGate} from "../../services/version_gate";


const searchClient = algoliasearch("A2HF2P5C6X", "45216ed5ac3f9e0a478d3c354d353d58");

export function Autocomplete() {
  const navigate = useNavigate();

  const [autocompleteState, setAutocompleteState] = useState<any>({});
  const [isFocused, setIsFocused] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const mobileFormRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  const desktopInputRef = useRef<HTMLInputElement>(null);
  const desktopFormRef = useRef<HTMLDivElement>(null);
  const desktopPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    versionGate(searchClient);
  }, []);


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
      setIsFocused(true);
      autocomplete.setIsOpen(true);
    },
    onBlur: () => {
      setIsFocused(false);
      autocomplete.setIsOpen(false);
    },
    onKeyDown: (event) => {
      if (event.key === 'Escape') {
        setIsFocused(false);
        autocomplete.setIsOpen(false);
        desktopInputRef.current?.blur();
      }
    },
  });

  const mobileInputProps = autocomplete.getInputProps({
    inputElement: mobileInputRef.current,
    onFocus: () => {
      setIsFocused(true);
      autocomplete.setIsOpen(true);
    },
    onBlur: () => {
      setIsFocused(false);
      autocomplete.setIsOpen(false);
    },
    onKeyDown: (event) => {
      if (event.key === 'Escape') {
        setIsFocused(false);
        autocomplete.setIsOpen(false);
        mobileInputRef.current?.blur();
      }
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

  const renderPanel = (panelRef: React.RefObject<HTMLDivElement>, inputRef: React.RefObject<HTMLInputElement>, isMobile = false) =>
    autocompleteState.isOpen && (
      <>
        {/* @ts-ignore */}
        <div
          className={`
            absolute z-50 w-full left-0 right-0 overflow-auto
            transition-all duration-200 ease-in-out
            ${isMobile 
              ? `
                bg-white dark:bg-gray-800 
                border border-gray-200 dark:border-gray-600 
                rounded-b-2xl
                shadow-2xl
                -mt-px
                border-t-0
                max-h-[calc(100vh-120px)]
              `
              : `
                bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg
                border border-gray-200/50 dark:border-gray-600/50
                rounded-b-2xl
                shadow-2xl shadow-black/10 dark:shadow-black/30
                -mt-px
                border-t-0
                max-h-72
              `
            }
          `}
          {...autocomplete.getPanelProps({})}
          ref={panelRef}
        >
          {/* Subtle separator line */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-600 to-transparent mx-4" />

          {autocompleteState.collections.map((collection: any, index: number) => (
            <ul key={index} {...autocomplete.getListProps()} className={isMobile ? "py-2" : "py-2"}>
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
      ${isFocused ? "opacity-100" : "opacity-0 pointer-events-none"}
    `}
          onClick={() => {
            desktopInputRef.current?.blur();
            mobileInputRef.current?.blur();
          }}
        />

      {/* Mobile: nearly full-screen search */}
      <div className={`
        sm:hidden z-50 transition-all duration-300 ease-in-out
        ${isFocused 
          ? 'fixed inset-4 top-8' 
          : 'relative w-full'
        }
      `}>
        <div
          className={`
            transition-all duration-300 ease-in-out
            ${isFocused && autocompleteState.isOpen 
              ? 'shadow-2xl rounded-t-2xl' 
              : isFocused
                ? 'shadow-2xl rounded-2xl'
                : 'shadow-sm focus-within:shadow-xl rounded-full'
            }
            ${isFocused 
              ? 'w-full relative bg-white dark:bg-gray-800' 
              : 'w-full relative'
            }
          `}
          {...autocomplete.getRootProps({})}
          ref={mobileFormRef}
        >
          <FontAwesomeIcon
            icon={faSearch}
            className="absolute top-0 bottom-0 left-4 m-auto text-gray-500 dark:text-gray-400 z-10"
          />
          {/* @ts-ignore */}
          <input
            className={`
              w-full py-3 px-4 pl-12 leading-5 
              text-gray-900 dark:text-gray-100 
              bg-white dark:bg-gray-700 
              outline-none border border-gray-200 dark:border-gray-600 
              focus:border-gray-400 dark:focus:border-gray-500 
              transition-all duration-300
              ${isFocused && autocompleteState.isOpen 
                ? 'text-lg rounded-t-2xl border-b-0' 
                : isFocused
                  ? 'text-lg rounded-2xl'
                  : 'text-base rounded-full'
              }
            `}
            {...mobileInputProps}
            ref={mobileInputRef}
            placeholder={isFocused ? "Search anime..." : "Search"}
          />
          {isFocused && renderPanel(mobilePanelRef, mobileInputRef, true)}
        </div>
      </div>

      {/* Desktop: floating, always-visible search */}
      <div
        className={`
          hidden sm:flex z-50 left-1/2 -translate-x-1/2 w-full max-w-xl
          top-0 focus-within:top-16
          transition-all duration-300 ease-in-out
          scale-100 focus-within:scale-105
          relative
          ${isFocused && autocompleteState.isOpen 
            ? 'shadow-2xl' 
            : 'shadow-sm focus-within:shadow-xl'
          }
          ${isFocused && autocompleteState.isOpen 
            ? 'rounded-t-2xl' 
            : 'rounded-full'
          }
          bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg
        `}
        {...autocomplete.getRootProps({})}
        ref={desktopFormRef}
      >
        <FontAwesomeIcon
          icon={faSearch}
          className="absolute top-0 bottom-0 left-4 m-auto text-gray-500 dark:text-gray-400 z-10"
        />
        {/* @ts-ignore */}
        <input
          ref={desktopInputRef}
          className={`
            w-full py-2 px-4 pl-10 text-base outline-none 
            text-gray-900 dark:text-gray-100 
            bg-white dark:bg-gray-700 
            border border-gray-200 dark:border-gray-600 
            focus:border-gray-400 dark:focus:border-gray-500 
            transition-all duration-300
            ${isFocused && autocompleteState.isOpen 
              ? 'rounded-t-2xl border-b-0' 
              : 'rounded-full'
            }
          `}
          {...inputProps}
        />
        <div className="absolute top-full left-0 right-0">
          {renderPanel(desktopPanelRef, desktopInputRef, false)}
        </div>
      </div>
    </>
  );
}
