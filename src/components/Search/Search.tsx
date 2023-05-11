import React, {useState, Fragment} from 'react'
import {Combobox, Transition} from '@headlessui/react'
import useSWR from 'swr'
import useDebounce from "./useDebounce";
import {useNavigate} from "react-router-dom";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faSearch} from "@fortawesome/free-solid-svg-icons";

interface ISearch<T> {
  searchFunction: (query: string) => Promise<T[]>
  mapFunction: (selectItem: (item: T) => void) => (item: T) => JSX.Element
  parseSearchResult: (result: T) => string
  className?: string
}

function Search<T>({searchFunction, mapFunction, parseSearchResult, className}: ISearch<T>) {
  const [selectedItem, setSelectedItem] = useState<T>({
    name: '',
  } as T)
  const [query, setQuery] = useState('')
  const debouncedSearch = useDebounce(query, 300);
  const {data: items, error} = useSWR(() => debouncedSearch || null, searchFunction)
  const navigate = useNavigate()

  return (
    <div className={className}>
      <Combobox value={selectedItem} onChange={setSelectedItem}>
        <div className="relative mt-1">
          <div
            className="relative w-full cursor-default overflow-hidden rounded-full bg-white text-left  sm:text-sm relative">
            <FontAwesomeIcon size="1x" color="#333" icon={faSearch}
                             className={"absolute top-0 bottom-0 left-4 m-auto"}/>
            <Combobox.Input onChange={(event) => setQuery(event.target.value)}
                            displayValue={parseSearchResult}
                            className="w-full rounded-full py-2 px-3 pl-10 text-sm leading-5 text-gray-900 outline-none border border-gray-200 focus:border-gray-400 active:border-gray-400"
                            onKeyUp={(e) => {
                              if (e.key === 'Enter') {
                                navigate(`/search?query=${query}`)
                              }
                            }}
            />
          </div>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            afterLeave={() => setQuery('')}
          >
            <Combobox.Options
              className="absolute mt-1 rounded-md max-h-60 w-full overflow-auto bg-white py-1 text-base ring-opacity-5 focus:outline-none sm:text-sm ">
              {items?.map((item: T, index: number) => (
                <Combobox.Option
                  key={index}
                  value={item}
                  className="outline-none ui-active:text-white ui-not-active:text-black cursor-pointer select-none relative hover:bg-gray-200"
                >
                  {mapFunction(setSelectedItem)(item)}
                </Combobox.Option>))}
            </Combobox.Options>
          </Transition>
        </div>
      </Combobox>
    </div>
  )
}

export default Search