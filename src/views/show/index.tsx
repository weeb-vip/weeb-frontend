import {useLocation, useNavigate, useParams} from "react-router-dom";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {fetchDetails, upsertAnime} from "../../services/queries";
import Loader from "../../components/Loader";
import {SeriesDetails} from "../../services/api/details";
import Tables from "./components/Episodes";
import Tag from "./components/tag";
import {format, isDate, parse} from "date-fns";
import Tabs from "../../components/Tabs";
import Artworks from "./components/Artworks";
import Characters from "./components/Characters";
import Trailers from "./components/Trailers";
import {GetAnimeDetailsByIdQuery, Status} from "../../gql/graphql";
import {useEffect, useState} from "react";
import Button, {ButtonColor} from "../../components/Button";
import {StatusType} from "../../components/Button/Button";

function formatUpdatedAt(date?: string): string {
    if (!date) {
        return "TBA"
    }
    const airdate = parse(date, 'yyyy-MM-dd HH:mm:ss', new Date())
    const formattedAirdate = isDate(airdate) ? format(airdate, 'dd MMM yyyy') : "TBA"
    return `Updated ${formattedAirdate}`
}

function Index() {
    const location = useLocation()
    const navigate = useNavigate(); // ← add this

    // const queryClient = useQueryClient()
    const {id} = useParams()
    // const [mediaID, setMediaID] = useState<string | undefined>(undefined)

    const {
        data: show,
        isLoading: showIsLoading,

    } = useQuery<GetAnimeDetailsByIdQuery>({
        ...(fetchDetails(id || "")),
        enabled: id !== undefined
    })

    useEffect(() => {
        if (!show && !showIsLoading) {
            navigate("/404", { replace: true });
        }
    }, [show, showIsLoading, navigate]);
    const [animeStatuses, setAnimeStatuses] = useState<Record<string, StatusType>>({});

    const mutateAddAnime = useMutation({
        ...upsertAnime(),
        onSuccess: (data) => {
            console.log("Added anime", data)
        },
        onError: (error) => {
            console.log("Error adding anime", error)
        }
    })

    const addAnime = async (id: string, animeId: string) => {
        setAnimeStatuses((prev) => ({...prev, [id]: "loading"}));
        try {
            await mutateAddAnime.mutateAsync({
                input: {
                    animeID: animeId,
                    status: Status.Plantowatch,
                }
            });
            console.log("Added anime", id, animeId)
            setAnimeStatuses((prev) => ({...prev, [id]: "success"}));
        } catch {
            setAnimeStatuses((prev) => ({...prev, [id]: "error"}));
        }
    };

    return (
        <div className="flex flex-col min-h-screen">

            <>
                {showIsLoading || !show ? <Loader/> : (
                    <>
                        <div className="relative flex flex-col lg:flex-row p-10 text-white overflow-hidden">
                            <div className={"absolute top-0 left-0 bottom-0 right-0"} style={{
                                // @ts-ignore
                                backgroundImage: `url(${global.config.api_host}/show/anime/anidb/series/${show?.anime?.anidbid}/fanart)`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                filter: 'blur(8px)',
                                zIndex: -1,
                                transform: 'scale(1.1)',
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                backgroundBlendMode: 'darken'
                            }}/>
                            <div className="flex flex-col px-4 m-y-auto lg:mr-16">
                                {/* @ts-ignore */}
                                <img src={`https://cdn.weeb.vip/weeb/${id}`}
                                     alt={show?.anime?.titleEn || ''}
                                     className={"max-w-none"}
                                     style={{height: '322px', width: '225px'}}
                                     onError={({currentTarget}) => {
                                         currentTarget.onerror = null; // prevents looping
                                         currentTarget.src = "/assets/not found.jpg";
                                     }}
                                />

                            </div>
                            <div className="flex flex-col space-y-2 p-2">
                                <h1
                                    className="text-3xl font-bold"
                                >{show?.anime.titleEn}</h1>
                                <div className={"flex flex-row flex-wrap space-x-4 space-y-4 space-x-reverse pb-4"}>
                                    <div className={"hidden -ml-4"}></div>
                                    <span>{`${formatUpdatedAt(show?.anime.updatedAt)}`}</span>
                                    <span>{show?.anime.broadcast || "unknown"}</span>
                                    {/*<Tag tag={show.score.toString()}/>*/}
                                    <span>{show?.anime.endDate ? "finished" : "ongoing"}</span>
                                    { /* network */}
                                    {show?.anime.broadcast && (
                                        <span>{show?.anime.broadcast || "unknown"}</span>
                                    )
                                    }
                                    {/*{show..map((network) => (*/}
                                    {/*  <Tag tag={network.name}/>*/}
                                    {/*))}*/}
                                </div>
                                <p>{show?.anime.description}</p>
                                {/*<Options show={show} type={type} id={id}/>*/}

                                <h2 className="text-xl font-bold pt-4">Tags</h2>
                                <div className={"flex flex-row flex-wrap space-x-4 space-y-4 space-x-reverse"}>
                                    <div className={"hidden -ml-4"}></div>
                                    {show?.anime.tags?.map((tag) => (
                                        <Tag tag={`${tag}`}/>
                                    ))}
                                </div>
                                <Button
                                  color={ButtonColor.blue}
                                  label={'Add to list'}
                                  showLabel={true}
                                  status={animeStatuses[show.anime.id] ?? "idle"}
                                  className="w-fit relative -left-5"
                                  onClick={() => {
                                      addAnime(show.anime.id, show.anime.id)
                                  }}
                                />
                            </div>

                        </div>
                        <div className="flex flex-col flex-grow bg-slate-300 px-4 sm:px-8 lg:px-16 py-4 sm:py-6 lg:py-8">
                            <Tabs tabs={["Episodes", "Characters", "Trailers", "Artworks"]} defaultTab={"Episodes"}>
                                <div className="w-full p-4 sm:p-6 lg:p-10">
                                    {show?.anime.episodes && (
                                      <Tables episodes={show?.anime?.episodes}/>
                                    )}
                                </div>
                                {/* table of characters */}
                                <div></div>

                                {/*<Characters characters={show?.characters || []}/>*/}
                                {/* grid of trailers */}
                                <div></div>
                                {/*<Trailers trailers={show?.trailers || []}/>*/}
                                { /* grid of artworks */}
                                <div></div>
                                {/*<Artworks artworks={show?.artworks || []}/>*/}
                            </Tabs>
                        </div>
                    </>
                )}
            </>


        </div>
    )
}

export default Index
