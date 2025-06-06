import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  deleteAnime,
  fetchUserAnimes,
  upsertAnime,
} from "../../../services/queries";
import Loader from "../../../components/Loader";
import {Status, UserAnime, UserAnimesQuery} from "../../../gql/graphql";
import AnimeCard, { AnimeCardStyle } from "../../../components/AnimeCard";
import { useState, useMemo } from "react";
import { GetImageFromAnime } from "../../../services/utils";
import {AnimeStatusDropdown, statusLabels} from "../../../components/AnimeStatusDropdown/AnimeStatusDropdown";



const PAGE_SIZE = 16;

function UserAnimeListPage() {

  const navigate = useNavigate();
  const [selectedStatus, setSelectedStatus] = useState<Status>(Status.Plantowatch);
  const [page, setPage] = useState(0);

  const input = useMemo(() => ({
    status: selectedStatus,
    limit: PAGE_SIZE,
    page: page + 1, // ← Shift from 0-based to 1-based
  }), [selectedStatus, page]);


  const { data, isLoading } = useQuery(
    fetchUserAnimes({ input })
  );



  if (isLoading) return <Loader />;

  const userAnimes = data?.animes || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col space-y-5 max-w-screen-2xl" style={{ margin: "0 auto" }}>
      <div className="flex flex-wrap gap-2 py-4">
        {Object.values(Status).map((status) => (
          <button
            key={status}
            onClick={() => {
              setSelectedStatus(status);
              setPage(0);
            }}
            className={`px-3 py-1 rounded-full text-sm border transition
              ${selectedStatus === status
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}`}
          >
            {statusLabels[status]}
          </button>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-semibold capitalize mb-4">{statusLabels[selectedStatus]}</h2>
        <div className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
          {/* @ts-ignore */}
          {userAnimes.map((entry: UserAnime) => (
            <AnimeCard
              style={AnimeCardStyle.DETAIL}
              key={`user-anime-${entry.id}`}
              id={entry.anime?.id}
              title={entry.anime?.titleEn || entry.anime?.titleJp || "Unknown"}
              description={entry.anime?.description || ""}
              episodes={entry.anime?.episodeCount || 0}
              episodeLength={entry.anime?.duration?.replace(/per.+?$|per/gm, '') || "?"}
              image={GetImageFromAnime(entry.anime)}
              className="hover:cursor-pointer"
              onClick={() => navigate(`/show/${entry.anime?.id}`)}
              year={entry.anime?.startDate ? new Date(entry.anime.startDate).getFullYear().toString() : "Unknown"}
              options={[
                <>
                  {/* @ts-ignore */}
                <AnimeStatusDropdown entry={entry} key={`dropdown-${entry.id}`} />
                </>,
              ]}
            />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center pt-4">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              disabled={page === 0}
              className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
            >
              Previous
            </button>

            <span className="text-sm text-gray-600">
              Page {page + 1} of {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
              disabled={page + 1 >= totalPages}
              className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserAnimeListPage;
