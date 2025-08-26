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
      className="aa-Item p-2 flex flex-row hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300 cursor-pointer"
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
      <SafeImage
        src={GetImageFromAnime(item)}
        alt={item.name}
        style={{height: '50px'}}
        className={"aspect-2/3 m-2"}
        onError={({currentTarget}) => {
          currentTarget.onerror = null; // prevents looping
          currentTarget.src = "/assets/not found.jpg";
        }}
      />
      <div className={"flex flex-col flex-shrink"}>
        <span className="text-gray-900 dark:text-gray-100 font-medium">{item.title_en}</span>
        <span className="text-gray-600 dark:text-gray-400 text-sm">{isValid(new Date(item.start_date)) ? format(new Date(item.start_date), "yyyy") : ''}</span>
      </div>
    </li>
  )
}