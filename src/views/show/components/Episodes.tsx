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
      <div className={"flex flex-row flex-grow flex-nowrap p-5 space-x-5 items-center bg-white"}>
        <FontAwesomeIcon size="2xl" color="#666" icon={faBookmark}/>
        <h1 className={"text-left text-2xl font-normal"}>Episodes</h1>
        {/*transition arrow direction*/}
      </div>

        <table className="table-auto leading-normal w-full">
          <thead>
          <tr>
            <th scope="col"
                className="px-5 py-3 text-base font-normal text-left text-gray-800 uppercase bg-white border-b border-gray-200"
            >
              #
            </th>
            <th scope="col"
                className="px-5 py-3 text-base font-normal text-left text-gray-800 uppercase bg-white border-b border-gray-200">Name
            </th>
            <th scope="col"
                className="px-5 py-3 text-base font-normal text-left text-gray-800 uppercase bg-white border-b border-gray-200">Aired
            </th>
          </tr>
          </thead>
          <tbody>
          {episodes.map((episode) => {
            const airdate = episode.airDate ? parseISO(episode.airDate) : null
            const formattedAirdate = airdate && isDate(airdate) ? format(airdate, 'dd MMM yyyy', { in: utc}) : "TBA"

            return (
              <tr key={episode.id}>
                <td className="px-5 py-5 text-base bg-white border-b border-gray-200">
                  {/*<RouterLink to={`/anime/${type}/${id}/${episode.id}`}>*/}
                  {/*{`Episode ${index+1}`}*/}
                  {episode.episodeNumber}
                  {/*</RouterLink>*/}
                </td>
                <td className="px-5 py-5 text-base bg-white border-b border-gray-200">
                  {/*<RouterLink to={`/anime/${type}/${id}/${episode.id}`}>*/}
                  {episode.titleEn || "TBA"}
                  {/*</RouterLink>*/}
                </td>
                <td className="px-5 py-5 text-base bg-white border-b border-gray-200">
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
