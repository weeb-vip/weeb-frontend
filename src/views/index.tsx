import AnimeCard, {AnimeCardStyle} from "../components/AnimeCard";
import SearchBox from "./search/components/SearchBox";
import {useRef, useState} from "react";
import {fetchSearchAdvancedResults, fetchSearchResults} from "../services/queries";
import {useQuery} from "@tanstack/react-query";
import Loader from "../components/Loader";
import {searchResult, searchResults} from "../services/api/search";
import {useNavigate} from "react-router-dom";
import Button, {ButtonColor} from "../components/Button";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronCircleLeft, faChevronCircleRight} from "@fortawesome/free-solid-svg-icons";

function Index() {
  const animeCardRef = useRef<HTMLDivElement>(null)
  const newestAnimeRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [query, setQuery] = useState<string>("")
  // const {data: topAnime, isLoading} = useQuery<searchResults>(fetchSearchResults("anime"))
  const {
    data: newestAnime,
    isLoading
  } = useQuery<searchResults>(fetchSearchAdvancedResults("anime", new Date().getFullYear(), 50, 10))

  return (
    <div className={"flex flex-col w-full"}>
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-4xl font-bold"}>Newest Anime</h1>
        {isLoading ? <Loader/> : (
          <div
            className={'w-full flex flex-row space-x-4 m-auto py-8 cursor-pointer overflow-y-auto justify-center items-center'}>

            {/* button to scroll left */}
            <Button
              className={'flex-none w-12 h-12'}
              color={ButtonColor.transparent}
              label={""}
              onClick={() => {

                newestAnimeRef.current?.scrollBy({
                  top: 0,
                  left: -((animeCardRef.current?.clientWidth || 0) +16),
                  behavior: 'smooth'
                })

              }}
              showLabel={false}
              icon={<FontAwesomeIcon size="1x" color="#333" icon={faChevronCircleLeft} className={"w-6 h-6"}/>}
            />
            <div
              className={'w-full flex flex-row space-x-4 m-auto cursor-pointer overflow-y-auto'}
              ref={newestAnimeRef}
            >
              {/* button to scroll left */}

              {/* anime cards */}
              {newestAnime?.map((result: searchResult) => (
                <div ref={animeCardRef}>
                <AnimeCard
                  style={AnimeCardStyle.DETAIL}
                  title={result.name}
                  description={""}
                  episodes={"?"}
                  episodeLength={"?"}
                  year={result.year}
                  image={`${(global as any).config.api_host}/show/anime/${result.id.split('-')[0].toLowerCase()}/${result.id.replace(/[^0-9.]/gm, '')}/poster`}
                  onClick={() => {
                    navigate(`/show/${result.id.split('-')[0].toLowerCase()}/${result.id.replace(/[^0-9.]/gm, '')}`)
                  }}

                />
                </div>
              ))}
            </div>
            {/* button to scroll right */}

            <Button
              className={'flex-none w-12 h-12'}
              color={ButtonColor.transparent}
              onClick={() => {
                // use react ref to scroll to the right
                newestAnimeRef.current?.scrollBy({
                  top: 0,
                  // clientwidth and margin  left of the anime card
                  left: (animeCardRef.current?.offsetWidth || 0) + 16,
                  behavior: 'smooth'
                })
              }}
              label={"Next"}
              icon={<FontAwesomeIcon size="1x" color="#333" icon={faChevronCircleRight} className={"w-6 h-6"}/>}
            />

          </div>

        )}
      </div>
    </div>

  );
}

export default Index;