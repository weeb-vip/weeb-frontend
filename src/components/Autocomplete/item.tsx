import {format, isValid} from "date-fns";
import React from "react";
import {AutocompleteApi} from "@algolia/autocomplete-js";
import {SafeImage} from "../SafeImage/SafeImage";
import {GetImageFromAnime} from "../../services/utils";

export interface IItem {
  autocomplete: any
  item: any
  source: any
  navigate: any
  inputRef?: React.RefObject<HTMLInputElement>
}

export default function Item({autocomplete, item, source, navigate, inputRef}: IItem) {
  return (
    <li
      key={item.objectID}
      className="aa-Item px-4 py-3 flex flex-row hover:bg-gray-50/80 dark:hover:bg-gray-700/60 transition-all duration-200 cursor-pointer group border-b border-gray-100 dark:border-gray-700 last:border-b-0"
      {...autocomplete.getItemProps({
        item,
        source,
      })}
      onClick={() => {
        autocomplete.setIsOpen(false)
        autocomplete.setQuery('')
        navigate(`/show/${item.id ? encodeURIComponent(item.id) : ''}`)
        if (inputRef && inputRef.current) {
          (inputRef.current as HTMLInputElement).blur()
        }
      }}
    >
      <div className="flex-shrink-0 mr-3">
        <SafeImage
          src={GetImageFromAnime(item)}
          alt={item.name}
          style={{height: '50px'}}
          className="aspect-2/3 rounded-md shadow-sm group-hover:shadow-md transition-shadow duration-200"
          onError={({currentTarget}) => {
            currentTarget.onerror = null; // prevents looping
            currentTarget.src = "/assets/not found.jpg";
          }}
        />
      </div>
      <div className="flex flex-col justify-center flex-1 min-w-0">
        <span className="text-gray-900 dark:text-gray-100 font-medium text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
          {item.title_en}
        </span>
        <span className="text-gray-500 dark:text-gray-400 text-xs">
          {isValid(new Date(item.start_date)) ? format(new Date(item.start_date), "yyyy") : ''}
        </span>
      </div>
    </li>
  )
}