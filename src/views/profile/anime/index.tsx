import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  deleteAnime,
  fetchUserAnimes,
  upsertAnime,
} from "../../../services/queries";
import Loader from "../../../components/Loader";
import { Status, UserAnimesQuery } from "../../../gql/graphql";
import AnimeCard, { AnimeCardStyle } from "../../../components/AnimeCard";
import { useState, useMemo } from "react";
import Button, { ButtonColor } from "../../../components/Button";
import { faChevronDown, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Menu, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { GetImageFromAnime } from "../../../services/utils";

const statusLabels: Record<Status, string> = {
  [Status.Completed]: "Completed",
  [Status.Dropped]: "Dropped",
  [Status.Onhold]: "On Hold",
  [Status.Plantowatch]: "Plan to Watch",
  [Status.Watching]: "Watching",
};

const PAGE_SIZE = 16;

function UserAnimeListPage() {
  const queryClient = useQueryClient();
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

  const { mutate: mutateDeleteAnime } = useMutation({
    ...deleteAnime(),
    onSuccess: () => {
      queryClient.invalidateQueries(["user-animes"]);
    },
  });

  const { mutate: mutateUpdateAnime } = useMutation({
    ...upsertAnime(),
    onSuccess: () => {
      queryClient.invalidateQueries(["user-animes"]);
    },
  });

  const onClickDeleteAnime = (animeId: string) => {
    mutateDeleteAnime(animeId);
  };

  const onChangeStatus = (animeID: string, newStatus: Status) => {
    mutateUpdateAnime({ input: { animeID, status: newStatus } });
  };

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
          {userAnimes.map((entry) => (
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
                <div key={`user-anime-${entry.id}-actions`} className="flex flex-wrap gap-2 relative z-20 items-center justify-center">
                  <Menu as="div" className="relative inline-block text-left">
                    <div>
                      <Menu.Button
                        className="inline-flex items-center justify-between rounded-full bg-gray-200 px-2 py-1 text-xs font-medium text-gray-800 shadow-sm hover:bg-gray-300">
                        <span>{statusLabels[entry.status ?? Status.Plantowatch]}</span>
                        <FontAwesomeIcon icon={faChevronDown} className="w-3 h-3 ml-2 text-gray-500" />
                      </Menu.Button>
                    </div>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute top-full left-0 mt-1 w-44 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                        {Object.values(Status).map((statusOption) => (
                          <Menu.Item key={statusOption}>
                            {({ active }) => (
                              <button
                                className={`${active ? "bg-blue-100" : ""} block w-full text-left px-4 py-2 text-sm text-gray-700`}
                                onClick={() => onChangeStatus(entry.anime?.id || "", statusOption)}
                              >
                                {statusLabels[statusOption]}
                              </button>
                            )}
                          </Menu.Item>
                        ))}
                      </Menu.Items>
                    </Transition>
                  </Menu>
                  <Button
                    className="text-xs"
                    label=""
                    onClick={() => onClickDeleteAnime(entry.anime?.id || "")}
                    icon={<FontAwesomeIcon icon={faTrash} className="text-white" />}
                    color={ButtonColor.red}
                    showLabel={true}
                  />
                </div>
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
