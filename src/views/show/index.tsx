import {useParams} from "react-router-dom";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {fetchDetails} from "../../services/queries";
import Loader from "../../components/Loader";
import {useEffect, useState} from "react";
import {SeriesDetails} from "../../services/api/details";
import Tables from "./components/Episodes";
import Tag from "./components/tag";
import {format, isDate, parse} from "date-fns";
import Tabs from "../../components/Tabs";
import Artworks from "./components/Artworks";
import Characters from "./components/Characters";
import Trailers from "./components/Trailers";

function formatUpdatedAt(date?: string): string {
  if (!date) {
    return "TBA"
  }
  const airdate = parse(date, 'yyyy-MM-dd HH:mm:ss', new Date())
  const formattedAirdate = isDate(airdate) ? format(airdate, 'dd MMM yyyy') : "TBA"
  return `Updated ${formattedAirdate}`
}

function Index() {
  // const queryClient = useQueryClient()
  const {id, type} = useParams()
  // const [mediaID, setMediaID] = useState<string | undefined>(undefined)

  console.log(id)
  const {
    data: show,
    isLoading: showIsLoading,

  } = useQuery<SeriesDetails>({
    ...fetchDetails(id || "", type || ""),
    enabled: id !== undefined
  })

  return (
    <div className="flex flex-col min-h-screen">
      {showIsLoading && !show ? <Loader/> : (
        <>
          <div className="relative flex flex-col lg:flex-row p-10 text-white overflow-hidden">
            <div className={"absolute top-0 left-0 bottom-0 right-0"} style={{
              // @ts-ignore
              backgroundImage: `url(${global.config.api_host}/show/anime/anidb/${type}/${id}/fanart)`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(8px)',
              zIndex: -1,
              transform: 'scale(1.1)',
              backgroundColor: 'rgba(0,0,0,0.5)',
              backgroundBlendMode: 'darken'
            }}/>
            <div className="flex flex-col px-4 m-auto lg:mr-16">
              {/* @ts-ignore */}
              <img src={`${global.config.api_host}/show/anime/anidb/${type}/${id}/poster`}
                   alt={show?.translations?.name}
                   className={"max-w-none"}
                   style={{height: '322px', width: '225px'}}
                   onError={({ currentTarget }) => {
                     currentTarget.onerror = null; // prevents looping
                     currentTarget.src="/assets/not found.jpg";
                   }}
              />
            </div>
            <div className="flex flex-col space-y-2 p-2">
              <h1
                className="text-3xl font-bold"
              >{show?.translations.name}</h1>
              <div className={"flex flex-row flex-wrap space-x-4 space-y-4 space-x-reverse pb-4"}>
                <div className={"hidden -ml-4"}></div>
                <span>{`${formatUpdatedAt(show?.lastUpdated)}`}</span>
                <span>{show?.status.recordType || "unknown"}</span>
                {/*<Tag tag={show.score.toString()}/>*/}
                <span>{show?.status.keepUpdated ? "ongoing" : "finished"}</span>
                { /* network */}
                {show?.originalNetwork && (
                  <span>{show?.originalNetwork.name || "unknown"}</span>
                )
                }
                {/*{show..map((network) => (*/}
                {/*  <Tag tag={network.name}/>*/}
                {/*))}*/}
              </div>
              <p>{show?.translations.overview}</p>
              {/*<Options show={show} type={type} id={id}/>*/}

              <h2 className="text-xl font-bold pt-4">Tags</h2>
              <div className={"flex flex-row flex-wrap space-x-4 space-y-4 space-x-reverse"}>
                <div className={"hidden -ml-4"}></div>
                {show?.tags?.map((tag) => (
                  <Tag tag={`${tag.tagName}:  ${tag.name}`}/>
                ))}
                {show?.genres.map((genre) => (
                  <Tag tag={genre.name}/>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col flex-grow bg-slate-300 px-16 py-8">
            <Tabs tabs={["Episodes", "Characters", "Trailers", "Artworks"]} defaultTab={"Episodes"}>
              <div className="flex flex-row space-x-2 p-10 bg-slate-300 flex-grow">
                <>
                  {show?.episodes && (
                    <Tables episodes={show.episodes}/>
                  )}
                </>
              </div>
              {/* table of characters */}
              <Characters characters={show?.characters || []}/>
              {/* grid of trailers */}
              <Trailers trailers={show?.trailers || []}/>
              { /* grid of artworks */}
              <Artworks artworks={show?.artworks || []}/>
            </Tabs>
          </div>
        </>
      )}
    </div>
  )
}

export default Index