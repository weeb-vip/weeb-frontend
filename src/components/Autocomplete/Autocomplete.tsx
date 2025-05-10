import React from "react";
import algoliasearch from "algoliasearch/lite";
import {createAutocomplete} from '@algolia/autocomplete-core';
import {getAlgoliaResults} from '@algolia/autocomplete-preset-algolia';
import {faSearch} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {useNavigate} from "react-router-dom";
import {format, isValid} from "date-fns";
import {AutocompleteApi} from "@algolia/autocomplete-js";
import Item from "./item";
import {auto} from "@popperjs/core";


const searchClient = algoliasearch(
  'A2HF2P5C6X',
  '45216ed5ac3f9e0a478d3c354d353d58'
);

export function Autocomplete() {
  const navigate = useNavigate();

  // (1) Create a React state.
  const [autocompleteState, setAutocompleteState] = React.useState({});
  const inputRef = React.useRef(null);
  const formRef = React.useRef(null);
  const panelRef = React.useRef(null);


  const autocomplete = React.useMemo(
    () =>
      createAutocomplete({
        onStateChange({state}) {
          // (2) Synchronize the Autocomplete state with the React state.
          setAutocompleteState(state);
        },
        // @ts-ignore
        getSources() {
          return [
            // (3) Use an Algolia index source.
            {
              sourceId: 'data',
              getItemInputValue({item}) {
                return item.title_en;
              },
              getItems({query}) {
                return getAlgoliaResults({
                  searchClient,
                  queries: [
                    {
                      indexName: 'anime',
                      query,
                      params: {
                        hitsPerPage: 20,
                        highlightPreTag: '<mark>',
                        highlightPostTag: '</mark>',
                      },
                    },
                  ],
                });
              },
              getItemUrl({item}) {
                return item;
              },
            },
          ];
        },
      }),
    []
  );

  const {getEnvironmentProps} = autocomplete;
  React.useEffect(() => {
    if (!(formRef.current && panelRef.current && inputRef.current)) {
      return;
    }

    const {onTouchStart, onTouchMove, onMouseDown} = getEnvironmentProps({
      formElement: formRef.current,
      panelElement: panelRef.current,
      inputElement: inputRef.current,
    });

    window.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('mousedown', onMouseDown);

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mousedown', onMouseDown);
    };
    // @ts-ignore
  }, [getEnvironmentProps, autocompleteState.isOpen]);

  return (
    <div
      className="relative cursor-default rounded-full bg-white text-left  sm:text-sm relative" {...autocomplete.getRootProps({})}
      ref={formRef}
    >
      <FontAwesomeIcon size="1x" color="#333" icon={faSearch}
                       className={"absolute top-0 bottom-0 left-4 m-auto"}/>
      {/* @ts-ignore */}
      <input
        className="rounded-full w-64 py-2 px-3 pl-10 text-sm leading-5 text-gray-900 outline-none border border-gray-200 focus:border-gray-400 active:border-gray-400"
        // @ts-ignore
        {...autocomplete.getInputProps({})}
        ref={inputRef}/>
      {/* @ts-ignore */}
      <div className="aa-Panel absolute z-10 bg-white w-full mx-4 left-0 right-0 max-h-60 overflow-auto"
           {...autocomplete.getPanelProps({})}>
        {/* @ts-ignore */}
        {autocompleteState.isOpen && autocompleteState.collections.map((collection: any, index: number) => {
          const {source, items} = collection;

          return (
            <div key={`source-${index}`} className="aa-Source" ref={panelRef}>
              {items.length > 0 && (
                <ul className="aa-List" {...autocomplete.getListProps()}>
                  {/* @ts-ignore */}
                  {items.filter((item) => isValid(new Date(item.start_date))).map((item: any) => (
                    <Item key={item.objectID} item={item} source={source} navigate={navigate}  autocomplete={autocomplete}/>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );


}
