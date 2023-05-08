import AnimeCard, {AnimeCardStyle} from "../../components/AnimeCard";
import SearchBox from "./components/SearchBox";
import {useNavigate, useParams, useSearchParams} from "react-router-dom";
import {searchResult, searchResults} from "../../services/api/search";
import {useQuery} from "@tanstack/react-query";
import {fetchSearchResults} from "../../services/queries";
import {useEffect} from "react";
import Loader from "../../components/Loader";

function Index() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams();
  const isEnabled = Boolean(!!searchParams.get("query"))
  const {
    data: results,
    isLoading: loadingSearchResults,
    isFetching: isFetchingResults,
    refetch: refetchSearchResults
  } = useQuery<searchResults>({
    ...fetchSearchResults(searchParams.get("query") || ""),
    enabled: !!searchParams.get("query") ? isEnabled : !isEnabled,
  })
  useEffect(() => {
    refetchSearchResults()
  }, [searchParams])
  return (
    <div className={"flex flex-col w-full"}>
      { /* Search box no dropdown */}
      <SearchBox callback={(value) => {
        setSearchParams({query: value})
      }} defaultValue={searchParams.get("query") || ""}
                 className={"w-full flex flex-row justify-center items-center space-x-2  px-16"}
      />
      {loadingSearchResults || isFetchingResults ? <Loader/> : (
        <>
          <div
            className={'w-full grid xs:grid-cols-[repeat(auto-fit,50%)] sm:grid-cols-[repeat(auto-fit,_33.333333%)] lg:grid-cols-[repeat(auto-fit,_25%)] xl:grid-cols-[repeat(auto-fit,_16.66666%)] 2xl:grid-cols-[repeat(auto-fit,_12.5%)] m-auto p-24 justify-center gap-y-16 cursor-pointer'}>
            {results?.map((result: searchResult) => (
              <AnimeCard
                style={AnimeCardStyle.DETAIL}
                title={result.name}
                description={""}
                episodes={"?"}
                episodeLength={"?"}
                year={result.year || "?"}
                image={`${(global as any).config.api_host}/show/anime/${result.id.split('-')[0].toLowerCase()}/${result.id.replace(/[^0-9.]/gm, '')}/poster`}
                onClick={() => {
                  navigate(`/show/${result.type}/${result.anidbid}`)
                }}
              />
            ))}
          </div>
        </>
      )}

    </div>
  );
}

export default Index;