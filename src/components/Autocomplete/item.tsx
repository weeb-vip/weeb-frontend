import {format, isValid} from "date-fns";
import React from "react";
import {AutocompleteApi} from "@algolia/autocomplete-js";

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
      className="aa-Item p-2 flex flex-row"
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
      <img
        src={`https://cdn.weeb.vip/weeb/${item.id}`}
        alt={item.name}
        style={{height: '50px'}}
        className={"aspect-2/3 m-2"}
        onError={({currentTarget}) => {
          currentTarget.onerror = null; // prevents looping
          currentTarget.src = "/assets/not found.jpg";
        }}
      />
      <div className={"flex flex-col flex-shrink"}>
        <span>{item.title_en}</span>
        <span>{isValid(new Date(item.start_date)) ? format(new Date(item.start_date), "yyyy") : ''}</span>
      </div>
    </li>
  )
}