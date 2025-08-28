import Card from "../Card";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCalendar, faClapperboard, faClock} from "@fortawesome/free-solid-svg-icons";
import Button, {ButtonColor} from "../Button";
import {Skeleton} from "../Skeleton/Skeleton";
import {SafeImage} from "../SafeImage/SafeImage";
import {Link} from "react-router-dom";
import {getAirTimeDisplay} from "../../services/airTimeUtils";

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
  forceListLayout?: boolean
  title: string
  description: string
  episodes: number
  episodeLength: string
  year: string
  image: string
  onClick: () => void
  className?: string
  options: React.ReactNode[]
  id: string | null | undefined
  airTime?: {
    show: boolean
    text: string
    variant?: 'countdown' | 'scheduled' | 'aired' | 'airing'
    icon?: React.ReactNode
  }
  // For automatic air time calculation
  nextEpisode?: {
    airDate?: string | null
  } | null
  broadcast?: string | null
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
  airTime?: {
    show: boolean
    text: string
    variant?: 'countdown' | 'scheduled' | 'aired' | 'airing'
    icon?: React.ReactNode
  }
}

const cardStyles = {
  default: `w-48 h-72`,
  'hover-transparent': `w-48 h-72 hover:bg-gray-100 dark:hover:bg-gray-700`,
  hover: `w-48 h-72 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-lg`,
  transparent: `w-48 h-72 bg-transparent`,
  long: `w-96 h-96`,
  detail: ``,
  episode: ``,
}

function AnimeCard(props: AnimeCardProps | AnimeEpisodeCardProps) {
  // Calculate air time automatically if not provided manually
  const automaticAirTime = (props as AnimeCardProps).nextEpisode?.airDate && (props as AnimeCardProps).broadcast 
    ? getAirTimeDisplay((props as AnimeCardProps).nextEpisode?.airDate, (props as AnimeCardProps).broadcast)
    : null;
  
  // Use manual airTime if provided, otherwise use automatic calculation
  const displayAirTime = (props as AnimeCardProps).airTime || automaticAirTime;

  return (
    <Card
      className={`flex ${(props as AnimeCardProps).forceListLayout ? "flex-row" : "sm:flex-row md:flex-col"} bg-white dark:bg-gray-800 rounded-md shadow-sm w-full justify-center transition-colors duration-300 ${props.className || ''}`}
    >

      <Link to={`/show/${(props as AnimeCardProps).id}`}
            className={`flex flex-col flex-none bg-white dark:bg-gray-800 ${cardStyles[props.style]} flex-grow overflow-hidden transition-colors duration-300 ${(props as AnimeCardProps).forceListLayout ? "rounded-l-md" : "rounded-l-md lg:rounded-bl-none lg:rounded-t-md"} `}>
        <SafeImage
          src={props.image}
          alt={props.title}
          data-original-src={props.image}
          className={`aspect-2/3 object-cover flex-auto relative
          
        ${
            (props as AnimeCardProps).forceListLayout ? "w-24 sm:w-28 md:w-32" : "w-32 sm:w-40 md:w-48  "
          }`}
          onError={({currentTarget}) => {
            currentTarget.onerror = null; // prevents looping
            currentTarget.src = "/assets/not found.jpg";
          }}
        />
      </Link>
      {props.style === AnimeCardStyle.DETAIL && (
        <div
          className={`flex flex-col flex-grow min-w-0 sm:justify-start sm:align-left p-4 sm:w-full lg:w-full space-y-4 h-full relative w-full group`}
        >


          <Link to={`/show/${(props as AnimeCardProps).id}`} className={"flex overflow-hidden flex-col w-full"}>
            <div className="group w-full">
              {/* Default (visible) */}
              <span className="block whitespace-nowrap text-md font-bold w-full truncate group-hover:hidden text-gray-900 dark:text-gray-100">
    {props.title}
  </span>

              {/* On hover (revealed) */}
              <span
                className="hidden group-hover:block whitespace-nowrap w-max text-md font-bold group-hover:animate-marquee text-gray-900 dark:text-gray-100">
    {props.title}
  </span>
            </div>
            <div className="flex flex-col space-y-2 text-md font-normal mt-2 items-start text-gray-700 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faClapperboard}/>
                <span>{props.episodes}</span>
              </div>
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faClock}/>
                <span>{props.episodeLength}</span>
              </div>
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faCalendar}/>
                <span>{props.year}</span>
              </div>
              {displayAirTime?.show && (
                <div className={`flex items-center gap-2 ${
                  displayAirTime?.variant === 'countdown' ? 'text-red-600 dark:text-red-400' :
                  displayAirTime?.variant === 'airing' ? 'text-orange-600 dark:text-orange-400' :
                  displayAirTime?.variant === 'aired' ? 'text-green-600 dark:text-green-400' :
                  'text-blue-600 dark:text-blue-400'
                }`}>
                  {displayAirTime?.icon || <FontAwesomeIcon icon={faCalendar}/>}
                  <span className="text-xs font-medium">{displayAirTime?.text}</span>
                </div>
              )}
            </div>
          </Link>
          <div
            className={`flex flex-wrap gap-2 options w-full ${
              (props as AnimeCardProps).forceListLayout ? 'justify-start' : 'justify-center'
            }`}
          >
            {(props as AnimeCardProps).options?.length > 0 &&
              (props as AnimeCardProps).options.map((option, index) => (
                <div key={index} className="flex items-center">
                  {option}
                </div>
              ))}
          </div>


        </div>
      )}
      {props.style === AnimeCardStyle.EPISODE && (
        <div
          className={`flex flex-col flex-grow min-w-0 sm:justify-start sm:align-left p-4 sm:w-full lg:w-full space-y-4 h-full relative w-full  group`}
        >

          <Link to={`/show/${(props as AnimeCardProps).id}`} className={"flex flex-col overflow-hidden w-full"}>
            <div className="group w-full">
              {/* Default (visible) */}
              <span className="block whitespace-nowrap text-md font-bold w-full truncate group-hover:hidden text-gray-900 dark:text-gray-100">
    {props.title}
  </span>

              {/* On hover (revealed) */}
              <span
                className="hidden group-hover:block whitespace-nowrap text-md font-bold group-hover:animate-marquee">
    {props.title}
  </span>
            </div>
            <div className="group w-full">
              {/* Default (visible) */}
              <span className="block whitespace-nowrap text-md font-normal w-full truncate group-hover:hidden text-gray-900 dark:text-gray-100">
    {(props as AnimeEpisodeCardProps).episodeTitle}
  </span>

              {/* On hover (revealed) */}
              <span
                className="hidden group-hover:block whitespace-nowrap text-md font-normal group-hover:animate-marquee text-gray-900 dark:text-gray-100">
    {(props as AnimeEpisodeCardProps).episodeTitle}
  </span>
            </div>
            <div className={`flex flex-col w-full justify-between space-y-2`}>
              <span
                className={`flex-grow text-md text-base space-x-4 text-gray-600 dark:text-gray-400`}><span>{`episode ${(props as AnimeEpisodeCardProps).episodeNumber}`}</span></span>
              
              {/* Configurable air time display or fallback to airdate */}
              {(props as AnimeEpisodeCardProps).airTime?.show ? (
                <div className={`flex items-center gap-2 ${
                  (props as AnimeEpisodeCardProps).airTime?.variant === 'countdown' ? 'text-red-600 dark:text-red-400' :
                  (props as AnimeEpisodeCardProps).airTime?.variant === 'airing' ? 'text-orange-600 dark:text-orange-400' :
                  (props as AnimeEpisodeCardProps).airTime?.variant === 'aired' ? 'text-green-600 dark:text-green-400' :
                  'text-blue-600 dark:text-blue-400'
                }`}>
                  {(props as AnimeEpisodeCardProps).airTime?.icon || <FontAwesomeIcon icon={faCalendar}/>}
                  <span className="text-xs font-medium">{(props as AnimeEpisodeCardProps).airTime?.text}</span>
                </div>
              ) : (
                <span
                  className={`flex-grow text-md text-base space-x-4 text-gray-600 dark:text-gray-400`}><span>{(props as AnimeEpisodeCardProps).airdate}</span></span>
              )}
            </div>
          </Link>
          {/* if list align left */}
          <div
            className={`flex flex-wrap gap-2 options w-full ${
              (props as AnimeCardProps).forceListLayout ? 'justify-start' : 'justify-center'
            }`}
          >
            {(props as AnimeCardProps).options?.length > 0 &&
              (props as AnimeCardProps).options.map((option, index) => (
                <div key={index} className="flex items-center">
                  {option}
                </div>
              ))}
          </div>

        </div>
      )}
    </Card>
  )
}

export {AnimeCard as default, AnimeCardStyle}

export type {AnimeCardProps}


interface SkeletonProps {
  style: AnimeCardStyle;
  forceListLayout?: boolean;
}

export function AnimeCardSkeleton({style, forceListLayout = false}: SkeletonProps) {
  const isEpisode = style === AnimeCardStyle.EPISODE;

  return (
    <div
      className={`flex ${forceListLayout ? "flex-row" : "sm:flex-row md:flex-col"} 
        bg-white dark:bg-gray-800 rounded-md shadow-sm w-full transition-colors duration-300 
        ${isEpisode ? "w-24 sm:w-28 md:w-32" : "w-32 sm:w-40 md:w-44"} 
        overflow-hidden animate-pulse`}
    >

      <div
        className={`aspect-2/3 bg-gray-200 dark:bg-gray-700 ${
          forceListLayout ? "w-24 sm:w-28 md:w-32" : "w-32 sm:w-40 md:w-44"
        }`}
      />
      <div className="flex flex-col justify-between px-4 py-3 w-full h-full">
        <div className="space-y-2">
          <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded"/>
          {isEpisode ? (
            <>
              <div className="w-2/3 h-3 bg-gray-200 dark:bg-gray-700 rounded"/>
              <div className="w-1/2 h-3 bg-gray-200 dark:bg-gray-700 rounded"/>
              <div className="w-2/3 h-3 bg-gray-200 dark:bg-gray-700 rounded"/>
            </>
          ) : (
            <>
              <div className="w-2/3 h-3 bg-gray-200 dark:bg-gray-700 rounded"/>
              <div className="w-1/3 h-3 bg-gray-200 dark:bg-gray-700 rounded"/>
              <div className="w-1/4 h-3 bg-gray-200 dark:bg-gray-700 rounded"/>
            </>
          )}
        </div>
        <div className="pt-3">
          <div className="w-24 h-8 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto"/>
        </div>
      </div>
    </div>
  );
}
