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
  EPISODE = 'episode',

}

interface AnimeCardProps {
  style: AnimeCardStyle
  title: string
  description: string
  episodes: number
  episodeLength: string
  year: string
  image: string
  onClick: () => void
  className?: string
}

interface AnimeEpisodeCardProps {
  style: AnimeCardStyle
  title: string
  description: string
  episodes: string
  episodeLength: string
  year: string
  airdate: string
  episodeTitle: string
  episodeNumber: string
  image: string
  onClick: () => void
  className?: string
}

const cardStyles = {
  default: `w-48 h-72`,
  'hover-transparent': `w-48 h-72 hover:bg-gray-100`,
  hover: `w-48 h-72 hover:bg-gray-100 hover:shadow-lg`,
  transparent: `w-48 h-72 bg-transparent`,
  long: `w-96 h-96`,
  detail: ``,
  episode: ``,
}

function AnimeCard(props: AnimeCardProps|AnimeEpisodeCardProps) {
  return (
    <Card
      className={`flex sm:flex-row md:flex-col flex-none bg-white ${cardStyles[props.style]} drop-shadow-md flex-grow ${props.className || ''}`}
      onClick={props.onClick}>
      <img src={props.image} alt={props.title} className={`aspect-2/3 w-32 lg:w-48`}
           onError={({currentTarget}) => {
             currentTarget.onerror = null; // prevents looping
             currentTarget.src = "/assets/not found.jpg";
           }}
      />
      {props.style === AnimeCardStyle.DETAIL && (
        <div
          className={`flex flex-col items-center sm:justify-start sm:align-left md:justify-center p-4 sm:w-full lg:w-48 space-y-4 h-full relative w-full overflow-hidden group`}>
          <div className="group w-full">
            {/* Default (visible) */}
            <span className="block whitespace-nowrap text-md font-bold w-full truncate group-hover:hidden">
    {props.title}
  </span>

            {/* On hover (revealed) */}
            <span
              className="hidden group-hover:block whitespace-nowrap w-max text-md font-bold group-hover:animate-marquee">
    {props.title}
  </span>
          </div>
          <div className={`flex flex-row w-full justify-between`}>
            <span className={`flex-grow text-md font-normal space-x-4`}><FontAwesomeIcon size="1x" color="#333"
                                                                                         icon={faClapperboard}/><span>{props.episodes}</span></span>
            <span className={`flex-shrink text-md font-normal space-x-4 `}><FontAwesomeIcon size="1x" color="#333"
                                                                                            icon={faClock}/><span>{props.episodeLength}</span></span>
          </div>
          <div className={`flex flex-row w-full justify-between`}>
            <span className={`flex-grow text-md font-normal space-x-4`}><FontAwesomeIcon size="1x" color="#333"
                                                                                         icon={faCalendar}/><span>{props.year}</span></span>
          </div>
          <Button color={ButtonColor.blue} label={'Add to list'} showLabel={true} onClick={() => {
          }}/>
        </div>
      )}
      {props.style === AnimeCardStyle.EPISODE && (
        <div
          className={`flex flex-col items-center sm:justify-start sm:align-left md:justify-center p-4 sm:w-full lg:w-48 space-y-2 h-full relative w-full overflow-hidden group`}>

          <div className="group w-full">
            {/* Default (visible) */}
            <span className="block whitespace-nowrap text-md font-bold w-full truncate group-hover:hidden">
    {props.title}
  </span>

            {/* On hover (revealed) */}
            <span className="hidden group-hover:block whitespace-nowrap text-md font-bold group-hover:animate-marquee">
    {props.title}
  </span>
          </div>

          <div className={`flex flex-col w-full justify-between space-y-2`}>
            <span
              className={`w-full text-md font-normal flex-grow flex flex-col`}>{(props as AnimeEpisodeCardProps).episodeTitle}</span>
            <span className={`flex-grow text-md text-sm space-x-4 text-gray-600`}><span>{`episode ${(props as AnimeEpisodeCardProps).episodeNumber}`}</span></span>
            {/* show airdate*/}
            <span className={`flex-grow text-md text-sm space-x-4 text-gray-600`}><span>{(props as AnimeEpisodeCardProps).airdate}</span></span>
          </div>
          <Button color={ButtonColor.blue} label={'Add to list'} showLabel={true} onClick={() => {
          }}/>
        </div>
      )}
    </Card>
  )
}

export {AnimeCard as default, AnimeCardStyle}

export type {AnimeCardProps}