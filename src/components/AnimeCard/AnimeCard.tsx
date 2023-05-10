import Card from "../Card";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCalendar, faClapperboard, faClock} from "@fortawesome/free-solid-svg-icons";
import Button, {ButtonColor} from "../Button";

enum AnimeCardStyle {
  DEFAULT = 'default',
  HOVER_TRANSPARENT = 'hover-transparent',
  HOVER = 'hover',

  TRANSPARENT = 'transparent',
  LONG = 'long',
  DETAIL = 'detail',

}

interface AnimeCardProps {
  style: AnimeCardStyle
  title: string
  description: string
  episodes: string
  episodeLength: string
  year: string

  image: string
  onClick: () => void

}

const cardStyles = {
  default: `w-48 h-72`,
  'hover-transparent': `w-48 h-72 hover:bg-gray-100`,
  hover: `w-48 h-72 hover:bg-gray-100 hover:shadow-lg`,
  transparent: `w-48 h-72 bg-transparent`,
  long: `w-96 h-96`,
  detail: ``
}

function AnimeCard({style, title, description, episodes, episodeLength, year, image, onClick}: AnimeCardProps) {
  return (
    <Card className={`flex flex-col flex-none bg-white ${cardStyles[style]} drop-shadow-md flex-grow`}
          style={{width: '200px'}} onClick={onClick}>
      <img src={image} alt={title} className={`aspect-2/3`} style={{width: '200px'}}
           onError={({ currentTarget }) => {
             currentTarget.onerror = null; // prevents looping
             currentTarget.src="/assets/not found.jpg";
           }}
      />
      <div className={`flex flex-col items-center justify-center p-4 w-full space-y-4 h-full`}>
        <span className={`w-full text-md font-normal text-center flex-grow align-center justify-center flex flex-col`}>{title}</span>
        <div className={`flex flex-row w-full justify-between`}>
          <span className={`flex-grow text-md font-normal space-x-4`}><FontAwesomeIcon size="1x" color="#333" icon={faClapperboard}/><span>{episodes}</span></span>
          <span className={`flex-shrink text-md font-normal space-x-4 `}><FontAwesomeIcon size="1x" color="#333" icon={faClock}/><span>{episodeLength}</span></span>
        </div>
        <div className={`flex flex-row w-full justify-between`}>
          <span className={`flex-grow text-md font-normal space-x-4`}><FontAwesomeIcon size="1x" color="#333" icon={faCalendar}/><span>{year}</span></span>
        </div>
        <Button color={ButtonColor.blue} label={'Add to list'} showLabel={true} onClick={() => {}} disabled/>
      </div>
    </Card>
  )
}

export {AnimeCard as default, AnimeCardStyle}

export type {AnimeCardProps}