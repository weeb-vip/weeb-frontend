import Card from "../Card";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCalendar, faClapperboard, faClock, faBookmark} from "@fortawesome/free-solid-svg-icons";
import {SafeImage} from "../SafeImage/SafeImage";
// Using anchor tags instead of React Router Link
import {getAirTimeDisplay} from "../../services/airTimeUtils";
import {useAnimeCountdowns} from "../../hooks/useAnimeCountdowns";
import {useFlags} from "flagsmith/react";
import type {UserAnime} from "../../gql/graphql";
import {statusLabels} from "../AnimeStatusDropdown/AnimeStatusDropdown";

type UserAnimeStatus = Pick<UserAnime, "status">;

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
  // For watchlist detection - pass the entry object to detect watchlist status from options
  entry?: UserAnimeStatus | null
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
  },
  entry?: UserAnimeStatus | null
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
  const { getCountdown } = useAnimeCountdowns();
  // Temporarily disable flags to prevent crashes until Flagsmith is properly configured
  // const flags = useFlags(['watchlist_indicators']);
  const flags = { watchlist_indicators: null };

  // Get real-time countdown from web worker if available
  const workerCountdown = (props as AnimeCardProps).id ? getCountdown((props as AnimeCardProps).id!) : null;

  // Calculate air time display
  let displayAirTime = (props as AnimeCardProps).airTime;

  if (!displayAirTime && (props as AnimeCardProps).nextEpisode?.airDate && (props as AnimeCardProps).broadcast) {
    // Use worker countdown if available, otherwise fallback to static calculation
    if (workerCountdown) {
      displayAirTime = {
        show: true,
        text: workerCountdown.isAiring
          ? `Currently airing (${workerCountdown.countdown})`
          : workerCountdown.hasAired
            ? "Recently aired"
            : workerCountdown.countdown.includes("m") || workerCountdown.countdown.includes("h")
              ? `Airing in ${workerCountdown.countdown}`
              : workerCountdown.countdown,
        variant: workerCountdown.isAiring
          ? 'airing' as const
          : workerCountdown.hasAired
            ? 'aired' as const
            : 'countdown' as const,
      };
    } else {
      // Fallback to static calculation
      displayAirTime = getAirTimeDisplay((props as AnimeCardProps).nextEpisode?.airDate, (props as AnimeCardProps).broadcast) || undefined;
    }
  }

  return (
    <Card
      className={`flex ${(props as AnimeCardProps).forceListLayout ? "flex-row" : "sm:flex-row md:flex-col"} dark:bg-gray-800 rounded-md shadow w-full justify-center transition-all duration-300 ${props.className || ''} relative`}
    >
      {/* Watchlist indicator */}
      {flags.watchlist_indicators?.getValue() && (props as AnimeCardProps).entry?.status && (
        <div className="absolute top-2 left-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg z-10">
          <FontAwesomeIcon icon={faBookmark} className="mr-1" />
          {(props as AnimeCardProps).entry?.status ? statusLabels[(props as AnimeCardProps).entry?.status as string] : 'Unknown'}
        </div>
      )}

      <a href={`/show/${(props as AnimeCardProps).id}`}
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
      </a>
      {props.style === AnimeCardStyle.DETAIL && (
        <div
          className={`flex flex-col flex-grow min-w-0 sm:justify-start sm:align-left p-4 sm:w-full lg:w-full space-y-4 h-full relative w-full group`}
        >


          <a href={`/show/${(props as AnimeCardProps).id}`} className={"flex overflow-hidden flex-col w-full"}>
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
          </a>
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

          <a href={`/show/${(props as AnimeCardProps).id}`} className={"flex flex-col overflow-hidden w-full"}>
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
          </a>
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

function getSkeletonLayout(style: AnimeCardStyle, forceListLayout: boolean) {
  const bg =
    style === AnimeCardStyle.TRANSPARENT ? 'bg-transparent' : 'bg-white dark:bg-gray-800';

  const base =
    `flex ${forceListLayout ? 'flex-row' : 'sm:flex-row md:flex-col'} ` +
    `${bg} rounded-md shadow-sm w-full transition-colors duration-300 ` +
    `overflow-hidden animate-pulse`;

  switch (style) {
    case AnimeCardStyle.LONG:
      return {
        container: `${base} w-96 h-40`,
        image: `${forceListLayout ? 'w-40 sm:w-48' : 'w-64 sm:w-72 md:w-80'} aspect-2/3`,
        lines: 5,
        isEpisode: false,
      };
    case AnimeCardStyle.DETAIL:
      return {
        container: `${base} min-h-[180px]`,
        image: `${forceListLayout ? 'w-32 sm:w-40' : 'w-40 sm:w-48 md:w-56'} aspect-2/3`,
        lines: 4,
        isEpisode: false,
      };
    case AnimeCardStyle.EPISODE:
      return {
        container: `${base} ${forceListLayout ? 'h-40' : 'h-44'}`,
        image: `${forceListLayout ? 'w-24 sm:w-28 md:w-32' : 'w-32 sm:w-40 md:w-44'} aspect-2/3`,
        lines: 4,
        isEpisode: true,
      };
    case AnimeCardStyle.HOVER:
    case AnimeCardStyle.HOVER_TRANSPARENT:
    case AnimeCardStyle.DEFAULT:
    default:
      return {
        container: `${base} w-48 h-72`,
        image: `${forceListLayout ? 'w-28 md:w-32' : 'w-32 sm:w-40 md:w-48'} aspect-2/3`,
        lines: 3,
        isEpisode: false,
      };
  }
}

export function AnimeCardSkeleton({ style, forceListLayout = false }: SkeletonProps) {
  const { container, image, lines, isEpisode } = getSkeletonLayout(style, forceListLayout);

  return (
    <div className={container}>
      <div className={`${image} bg-gray-200 dark:bg-gray-700`} />
      <div className="flex flex-col justify-between px-4 py-3 w-full h-full">
        <div className="space-y-2">
          {/* Title line */}
          <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded" />

          {isEpisode ? (
            <>
              <div className="w-2/3 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="w-1/2 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="w-2/3 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
            </>
          ) : (
            // Generic lines based on size
            Array.from({ length: lines - 1 }).map((_, i) => (
              <div
                key={i}
                className={[
                  'h-3 bg-gray-200 dark:bg-gray-700 rounded',
                  i === 0 ? 'w-2/3' : i === 1 ? 'w-1/3' : 'w-1/4',
                ].join(' ')}
              />
            ))
          )}
        </div>

        {/* Button / options stub */}
        <div className="pt-3">
          <div
            className={[
              'h-8 rounded-full',
              style === AnimeCardStyle.TRANSPARENT
                ? 'bg-gray-300/60 dark:bg-gray-600/60'
                : 'bg-gray-300 dark:bg-gray-600',
              forceListLayout ? 'mx-0 w-24' : 'mx-auto w-24',
            ].join(' ')}
          />
        </div>
      </div>
    </div>
  );
}

