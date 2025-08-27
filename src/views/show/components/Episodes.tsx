import React from "react";

import {format, isDate, parse, parseISO} from "date-fns";
import {faBookmark, faCircleChevronDown, faCircleChevronUp} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {Transition} from "@headlessui/react";
import Button, {ButtonColor} from "../../../components/Button";
import {Episode} from "../../../gql/graphql";
import {utc} from "@date-fns/utc/utc";
// import {Episode} from "../../../services/api/details";

function Table({seasonNumber, episodes}: { seasonNumber: number, episodes: Episode[] }) {
  return (
    <div className="inline-block min-w-full overflow-hidden rounded-lg shadow m-auto">
      <div className={"flex flex-row flex-grow flex-nowrap p-6 space-x-6 items-center bg-white dark:bg-gray-800 transition-colors duration-300"}>
        <FontAwesomeIcon size="2xl" color="#666" icon={faBookmark}/>
        <h1 className={"text-left text-2xl font-normal text-gray-900 dark:text-gray-100"}>Episodes</h1>
        {/*transition arrow direction*/}
      </div>

        <table className="table-auto leading-normal w-full">
          <thead>
          <tr>
            <th scope="col"
                className="px-5 py-3 text-base font-normal text-left text-gray-800 dark:text-gray-200 uppercase bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 transition-colors duration-300"
            >
              #
            </th>
            <th scope="col"
                className="px-5 py-3 text-base font-normal text-left text-gray-800 dark:text-gray-200 uppercase bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 transition-colors duration-300">Name
            </th>
            <th scope="col"
                className="px-5 py-3 text-base font-normal text-left text-gray-800 dark:text-gray-200 uppercase bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 transition-colors duration-300">Aired
            </th>
          </tr>
          </thead>
          <tbody>
          {episodes.map((episode) => {
            const airdate = episode.airDate ? parseISO(episode.airDate) : null
            const formattedAirdate = airdate && isDate(airdate) ? format(airdate, 'dd MMM yyyy', { in: utc}) : "TBA"

            return (
              <tr key={episode.id}>
                <td className="px-5 py-5 text-base bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 transition-colors duration-300">
                  {/*<RouterLink to={`/anime/${type}/${id}/${episode.id}`}>*/}
                  {/*{`Episode ${index+1}`}*/}
                  {episode.episodeNumber}
                  {/*</RouterLink>*/}
                </td>
                <td className="px-5 py-5 text-base bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 transition-colors duration-300">
                  {/*<RouterLink to={`/anime/${type}/${id}/${episode.id}`}>*/}
                  {episode.titleEn || "TBA"}
                  {/*</RouterLink>*/}
                </td>
                <td className="px-5 py-5 text-base bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 transition-colors duration-300">
                  {formattedAirdate}
                </td>

              </tr>
            )
          })}
          </tbody>
        </table>
    </div>
  )
}

function Tables({
                  episodes,
                }: { episodes: Episode[] }) {



  return (
    <div className="flex flex-col flex-grow">
      <div className={"hidden"}/>
        { /* @ts-ignore */}
        <Table seasonNumber={1} episodes={episodes.sort((a: Episode, b: Episode) => a.episodeNumber - b.episodeNumber)}/>

    </div>
  );
}

export default Tables;
