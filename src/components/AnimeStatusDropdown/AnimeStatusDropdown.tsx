import {Menu, Transition} from "@headlessui/react";
import {Status, Anime} from "../../gql/graphql";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronDown, faTrash} from "@fortawesome/free-solid-svg-icons";
import {Fragment} from "react";
import Button, {ButtonColor} from "../Button";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {deleteAnime, upsertAnime} from "../../services/queries";
export const statusLabels: Record<Status, string> = {
  [Status.Completed]: "Completed",
  [Status.Dropped]: "Dropped",
  [Status.Onhold]: "On Hold",
  [Status.Plantowatch]: "Plan to Watch",
  [Status.Watching]: "Watching",
};
interface AnimeStatusDropdownProps {
  entry: {
    id: string;
    anime?: Anime;
    status?: Status;
  };
}

export function AnimeStatusDropdown({entry}: AnimeStatusDropdownProps) {
  const queryClient = useQueryClient();
  const { mutate: mutateDeleteAnime } = useMutation({
    ...deleteAnime(),
    onSuccess: () => {
      queryClient.invalidateQueries(["user-animes"]);
      queryClient.invalidateQueries(["anime-details", entry.anime?.id]);
      queryClient.invalidateQueries(["homedata"]);
      queryClient.invalidateQueries(["currently-airing"]);
    },
  });

  const { mutate: mutateUpdateAnime } = useMutation({
    ...upsertAnime(),
    onSuccess: () => {
      queryClient.invalidateQueries(["user-animes"]);
      queryClient.invalidateQueries(["anime-details", entry.anime?.id]);
      queryClient.invalidateQueries(["homedata"]);
      queryClient.invalidateQueries(["currently-airing"]);
    },
  });

  const onClickDeleteAnime = (animeId: string) => {
    mutateDeleteAnime(animeId);
  };

  const onChangeStatus = (animeID: string, newStatus: Status) => {
    mutateUpdateAnime({ input: { animeID, status: newStatus } });
  };
  return (
    <div key={`user-anime-${entry.id}-actions`}
         className="flex flex-col flex-wrap gap-2 relative z-20 justify-center items-center ">
      <Menu as="div" className="relative inline-block text-left">
        <div>
          <Menu.Button
            className="inline-flex items-center justify-between rounded-full bg-gray-200 dark:bg-gray-600 px-2 py-1 text-xs font-medium text-gray-800 dark:text-gray-200 shadow-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors duration-300">
            <span>{statusLabels[entry.status ?? Status.Plantowatch]}</span>
            <FontAwesomeIcon icon={faChevronDown} className="w-3 h-3 ml-2 text-gray-500 dark:text-gray-400"/>
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
          <Menu.Items
            className="absolute top-full left-0 mt-1 w-44 rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black dark:ring-gray-600 ring-opacity-5 dark:ring-opacity-20 focus:outline-none z-50 transition-colors duration-300">
            {Object.values(Status).map((statusOption) => (
              <Menu.Item key={statusOption}>
                {({active}) => (
                  <button
                    className={`${active ? "bg-blue-100 dark:bg-blue-900/50" : ""} block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-300`}
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
        icon={<FontAwesomeIcon icon={faTrash} className="text-white"/>}
        color={ButtonColor.red}
        showLabel={true}
      />
    </div>
  )
}