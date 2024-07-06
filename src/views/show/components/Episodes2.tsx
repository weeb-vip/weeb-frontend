import React from "react";

import {format, isDate, parse} from "date-fns";
import {faBookmark, faCircleChevronDown, faCircleChevronUp} from "@fortawesome/free-solid-svg-icons";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {Transition} from "@headlessui/react";
import Button, {ButtonColor} from "../../../components/Button";
import {Episode} from "../../../services/api/details";

interface EpisodeWtihStatus extends Episode {
  status: string

  progress: number

}

function Table({seasonNumber, episodes}: { seasonNumber: number, episodes: Episode[] }) {
  const [collapsed, setCollapsed] = React.useState<boolean>(false)
  return (
    <div className="inline-block min-w-full overflow-hidden rounded-lg shadow m-auto">
      <div className={"flex flex-row flex-grow flex-nowrap p-5 space-x-5 items-center bg-white"}>
        <FontAwesomeIcon size="2xl" color="#666" icon={faBookmark}/>
        <h1 className={"text-left text-2xl font-normal"}>Season {seasonNumber == 0 ? "Specials" : seasonNumber}</h1>
        {/*transition arrow direction*/}
        <Button
          color={ButtonColor.none}
          showLabel={false}
          label={'collapse'}
          onClick={() => setCollapsed(!collapsed)}
          icon={<FontAwesomeIcon size="2xl" color="#666"
                                 icon={!collapsed ? faCircleChevronDown : faCircleChevronUp}/>}/>
      </div>
      <Transition
        show={!collapsed}
        enter="transition-opacity duration-75"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-150"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <table className="table-auto leading-normal w-full">
          <thead>
          <tr>
            <th scope="col"
                className="px-5 py-3 text-sm font-normal text-left text-gray-800 uppercase bg-white border-b border-gray-200"
            >
              #
            </th>
            <th scope="col"
                className="px-5 py-3 text-sm font-normal text-left text-gray-800 uppercase bg-white border-b border-gray-200">Name
            </th>
            <th scope="col"
                className="px-5 py-3 text-sm font-normal text-left text-gray-800 uppercase bg-white border-b border-gray-200">Aired
            </th>
          </tr>
          </thead>
          <tbody>
          {episodes.map((episode) => {
            const airdate =episode.aired ? parse(episode.aired, 'yyyy-MM-dd', new Date()) : null
            const formattedAirdate = airdate && isDate(airdate) ? format(airdate, 'dd MMM yyyy') : "TBA"

            return (
              <tr key={episode.id}>
                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                  {/*<RouterLink to={`/anime/${type}/${id}/${episode.id}`}>*/}
                  {/*{`Episode ${index+1}`}*/}
                  {episode.number}
                  {/*</RouterLink>*/}
                </td>
                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                  {/*<RouterLink to={`/anime/${type}/${id}/${episode.id}`}>*/}
                  {episode.name || "TBA"}
                  {/*</RouterLink>*/}
                </td>
                <td className="px-5 py-5 text-sm bg-white border-b border-gray-200">
                  {formattedAirdate}
                </td>

              </tr>
            )
          })}
          </tbody>
        </table>
      </Transition>
    </div>
  )
}

function Tables({
                  episodes,
                }: { episodes: Episode[] }) {


  const episodesBySeason = episodes.reduce((acc: Record<string, Episode[]>, episode: Episode) => {
    if (!acc[episode.seasonNumber]) {
      acc[episode.seasonNumber] = [];
    }
    acc[episode.seasonNumber].push(episode);
    return acc;
  }, {});
  return (
    <div className="flex flex-col flex-grow space-y-16">
      <div className={"hidden"}/>
      {Object.entries(episodesBySeason).map(([seasonNumber, episodes]: [string, Episode[]]) => (
        <Table key={seasonNumber} seasonNumber={parseInt(seasonNumber, 10)} episodes={episodes}/>
      ))}
    </div>
  );
}

export default Tables;
