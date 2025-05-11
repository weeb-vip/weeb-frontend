import Card from "../Card";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCalendar, faClapperboard, faClock} from "@fortawesome/free-solid-svg-icons";
import Button, {ButtonColor} from "../Button";
import {Skeleton} from "../Skeleton/Skeleton";

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

function AnimeCard(props: AnimeCardProps | AnimeEpisodeCardProps) {
  return (
    <Card
      className={`flex ${(props as AnimeCardProps).forceListLayout ? "flex-row" : "sm:flex-row md:flex-col"} bg-white rounded-md shadow-sm w-full overflow-hidden  justify-center ${props.className || ''}`}


    >
      <img
        src={props.image}
        alt={props.title}
        className={`aspect-2/3 object-cover ${
          (props as AnimeCardProps).forceListLayout ? "w-24 sm:w-28 md:w-32" : "w-32 sm:w-40 md:w-48"
        }`}
        onError={({currentTarget}) => {
          currentTarget.onerror = null; // prevents looping
          currentTarget.src = "/assets/not found.jpg";
        }}
        onClick={props.onClick}
      />
      {props.style === AnimeCardStyle.DETAIL && (
        <div
          className={`flex flex-col  sm:justify-start sm:align-left p-4 sm:w-full lg:w-48 space-y-4 h-full relative w-full overflow-hidden group`}>

          <div onClick={props.onClick} className={"flex flex-col w-full"}>
            <div className="group w-full" >
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
            <div className="flex flex-col space-y-2 text-md font-normal mt-2 items-start">
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
            </div>
          </div>
          <div className={"options"}>
            <Button
              color={ButtonColor.blue}
              label={'Add to list'}
              showLabel={true}
              className="w-fit"
              onClick={() => {
              }}
            />
          </div>

        </div>
      )}
      {props.style === AnimeCardStyle.EPISODE && (
        <div
          className={`flex flex-col items-center sm:justify-start sm:align-left md:justify-center p-4 sm:w-full lg:w-48 space-y-4 h-full relative w-full overflow-hidden group`}>

          <div onClick={props.onClick} className={"flex flex-col w-full"}>
            <div className="group w-full">
              {/* Default (visible) */}
              <span className="block whitespace-nowrap text-md font-bold w-full truncate group-hover:hidden">
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
              <span className="block whitespace-nowrap text-md font-noraml w-full truncate group-hover:hidden">
    {(props as AnimeEpisodeCardProps).episodeTitle}
  </span>

              {/* On hover (revealed) */}
              <span
                className="hidden group-hover:block whitespace-nowrap text-md font-normal group-hover:animate-marquee">
    {(props as AnimeEpisodeCardProps).episodeTitle}
  </span>
            </div>
            <div className={`flex flex-col w-full justify-between space-y-2`}>

            <span
              className={`flex-grow text-md text-base space-x-4 text-gray-600`}><span>{`episode ${(props as AnimeEpisodeCardProps).episodeNumber}`}</span></span>
              {/* show airdate*/}
              <span
                className={`flex-grow text-md text-base space-x-4 text-gray-600`}><span>{(props as AnimeEpisodeCardProps).airdate}</span></span>
            </div>
          </div>
          <div className={"options"}>
            <Button
              color={ButtonColor.blue}
              label={'Add to list'}
              showLabel={true}
              className="w-fit"
              onClick={() => {
              }}
            />
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
        bg-white rounded-md shadow-sm w-full 
        ${isEpisode ? "w-24 sm:w-28 md:w-32" : "w-32 sm:w-40 md:w-44"} 
        overflow-hidden animate-pulse`}
    >

      <div
        className={`aspect-2/3 bg-gray-200 ${
          forceListLayout ? "w-24 sm:w-28 md:w-32" : "w-32 sm:w-40 md:w-44"
        }`}
      />
      <div className="flex flex-col justify-between px-4 py-3 w-full h-full">
        <div className="space-y-2">
          <div className="w-full h-4 bg-gray-200 rounded"/>
          {isEpisode ? (
            <>
              <div className="w-2/3 h-3 bg-gray-200 rounded"/>
              <div className="w-1/2 h-3 bg-gray-200 rounded"/>
              <div className="w-2/3 h-3 bg-gray-200 rounded"/>
            </>
          ) : (
            <>
              <div className="w-2/3 h-3 bg-gray-200 rounded"/>
              <div className="w-1/3 h-3 bg-gray-200 rounded"/>
              <div className="w-1/4 h-3 bg-gray-200 rounded"/>
            </>
          )}
        </div>
        <div className="pt-3">
          <div className="w-24 h-8 bg-gray-300 rounded-full mx-auto"/>
        </div>
      </div>
    </div>
  );
}