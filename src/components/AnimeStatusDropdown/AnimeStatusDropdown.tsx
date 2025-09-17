import {Menu, Transition} from "@headlessui/react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronDown, faTrash, faEllipsis} from "@fortawesome/free-solid-svg-icons";
import {Fragment, useRef, useState, useEffect, useCallback} from "react";
import Button, {ButtonColor} from "../Button";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import type {Anime} from "../../gql/graphql";
import {Status} from "../../gql/graphql";
import {deleteAnime, upsertAnime} from "../../services/queries";
export const statusLabels: Record<string, string> = {
  'COMPLETED': "Completed",
  'DROPPED': "Dropped",
  'ONHOLD': "On Hold",
  'PLANTOWATCH': "Watchlist",
  'WATCHING': "Watching",
};

interface AnimeStatusDropdownProps {
  entry: {
    id: string;
    anime?: Anime;
    status?: Status;
  };
  variant?: 'default' | 'compact' | 'hero' | 'icon-only';
  className?: string;
  buttonClassName?: string;
  deleteButtonClassName?: string;
  onDelete?: (animeId: string) => void;
}

export function AnimeStatusDropdown({
                                      entry,
                                      variant = 'default',
                                      className,
                                      buttonClassName,
                                      deleteButtonClassName,
                                      onDelete
                                    }: AnimeStatusDropdownProps) {
  const queryClient = useQueryClient();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuItemsRef = useRef<HTMLDivElement>(null);

  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  const { mutate: mutateDeleteAnime } = useMutation({
    ...deleteAnime(),
    onSuccess: () => {
      queryClient.invalidateQueries(["user-animes"]);
      queryClient.invalidateQueries(["anime-details", entry.anime?.id]);
      queryClient.invalidateQueries(["homedata"]);
      queryClient.invalidateQueries(["currently-airing"]);
      if (onDelete && entry.anime?.id) onDelete(entry.anime.id);
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

  // Recompute & clamp position helper
  const computeAndSetPosition = useCallback(() => {
    const btn = buttonRef.current;
    const menu = menuItemsRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();

    // Initial desired placement: below, left-aligned with button
    let desiredTop = rect.bottom + window.scrollY + 4;
    let desiredLeft = rect.left + window.scrollX;

    // If we can measure the menu, clamp horizontally & flip vertically if needed
    if (menu) {
      const menuW = menu.offsetWidth || 176; // default w-44 ≈ 176px
      const menuH = menu.offsetHeight || 0;

      // Flip above if not enough space below
      const spaceBelow = window.innerHeight - rect.bottom;
      if (menuH && spaceBelow < menuH + 8) {
        desiredTop = rect.top + window.scrollY - menuH - 4;
      }

      // Clamp horizontally to viewport
      const maxLeft = window.scrollX + (window.innerWidth - menuW - 8);
      const minLeft = window.scrollX + 8;
      desiredLeft = Math.min(Math.max(desiredLeft, minLeft), maxLeft);
    }

    setDropdownPosition({ top: desiredTop, left: desiredLeft });
  }, []);

  const onClickDeleteAnime = (animeId: string) => {
    mutateDeleteAnime(animeId);
  };

  const onChangeStatus = (animeID: string, newStatus: Status) => {
    mutateUpdateAnime({ input: { animeID, status: newStatus } });
  };

  // Variant-specific styling
  const getContainerClasses = () => {
    const base = "flex flex-row relative z-20 items-center gap-2 justify-center";
    switch (variant) {
      case 'compact':
        return `${base} w-full`;
      case 'hero':
        return base;
      case 'icon-only':
        return "relative inline-block text-left";
      default:
        return base;
    }
  };

  const getButtonClasses = () => {
    if (buttonClassName) {
      return `inline-flex items-center justify-between rounded-full bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 shadow-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors duration-300 ${buttonClassName}`;
    }
    const baseClasses = "inline-flex items-center justify-between rounded-full bg-gray-200 dark:bg-gray-600 px-2 py-2 text-base font-medium text-gray-800 dark:text-gray-200 shadow-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors duration-300";
    switch (variant) {
      case 'compact':
        return `${baseClasses} flex-1 min-w-0 px-4 py-2 text-xs`;
      case 'hero':
        return `${baseClasses} flex-grow min-w-[140px] px-4 py-2 text-base`;
      case 'icon-only':
        return "inline-flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 shadow-sm hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors duration-300 w-8 h-8";
      default:
        return `${baseClasses} flex-grow min-w-[120px] px-4 py-2 text-base`;
    }
  };

  const getDeleteButtonClasses = () => {
    if (deleteButtonClassName) return `flex-shrink-0 ${deleteButtonClassName}`;
    const baseClasses = "flex-shrink-0 px-2 py-2 min-w-[32px] h-[32px] text-base";
    switch (variant) {
      case 'compact':
        return `${baseClasses} px-1 py-1 min-w-[24px] h-[24px] text-xs`;
      case 'hero':
        return `${baseClasses} px-4 py-4 min-w-[40px] h-[40px] text-base`;
      default:
        return `${baseClasses} px-4 py-4 min-w-[40px] h-[40px] text-base`;
    }
  };

  const getMenuItemClasses = (active: boolean) => {
    const baseClasses = `${active ? "bg-blue-100 dark:bg-blue-900/50" : ""} block w-full text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-300`;
    switch (variant) {
      case 'compact':
        return `${baseClasses} px-2 py-2 text-xs`;
      case 'hero':
        return `${baseClasses} px-4 py-4 text-base`;
      case 'icon-only':
        return `${baseClasses} px-3 py-2 text-sm`;
      default:
        return `${baseClasses} px-4 py-4 text-base`;
    }
  };

  if (variant === 'icon-only') {
    return (
      <div key={`user-anime-${entry.id}-actions`} className={`${getContainerClasses()} ${className || ''}`}>
        <Menu as="div" className="relative inline-block text-left">
          <div>
            <Menu.Button className={getButtonClasses()} title={`Status: ${statusLabels[entry.status ?? 'PLAN_TO_WATCH']}`}>
              <FontAwesomeIcon icon={faEllipsis} className="w-3 h-3 text-gray-600 dark:text-gray-300" />
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
              className="absolute top-full right-0 mt-1 w-44 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black dark:ring-gray-600 ring-opacity-5 dark:ring-opacity-20 focus:outline-none z-[999]"
            >
              {/* Status options */}
              <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                Change Status
              </div>
              {Object.values(Status).map((statusOption) => (
                <Menu.Item key={statusOption}>
                  {({ active }) => (
                    <button
                      className={`${getMenuItemClasses(active)} ${entry.status === statusOption ? 'bg-blue-50 dark:bg-blue-900/30 font-medium' : ''}`}
                      onClick={() => onChangeStatus(entry.anime?.id || "", statusOption)}
                    >
                      {statusLabels[statusOption]}
                      {entry.status === statusOption && <span className="ml-2 text-blue-600 dark:text-blue-400">✓</span>}
                    </button>
                  )}
                </Menu.Item>
              ))}
              {/* Remove option */}
              <div className="border-t border-gray-200 dark:border-gray-600">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={`${getMenuItemClasses(active)} text-red-600 dark:text-red-400 font-medium`}
                      onClick={() => onClickDeleteAnime(entry.anime?.id || "")}
                    >
                      <FontAwesomeIcon icon={faTrash} className="w-3 h-3 mr-2" />
                      Remove from list
                    </button>
                  )}
                </Menu.Item>
              </div>
            </Menu.Items>
          </Transition>
        </Menu>
      </div>
    );
  }

  return (
    <div key={`user-anime-${entry.id}-actions`} className={`${getContainerClasses()} ${className || ''}`}>
      <Menu as="div" className="relative inline-block text-left">
        <div>
          <Menu.Button className={getButtonClasses()}>
            <span>{statusLabels[entry.status ?? 'PLAN_TO_WATCH']}</span>
            <FontAwesomeIcon icon={faChevronDown} className="w-3 h-3 ml-2 text-gray-500 dark:text-gray-400" />
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
            // NOTE: no portal, no "fixed". Just absolute under the button.
            className="absolute top-full left-0 mt-1 w-44 origin-top-left rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black dark:ring-gray-600 ring-opacity-5 dark:ring-opacity-20 focus:outline-none z-[999]"
          >
            {Object.values(Status).map((statusOption) => (
              <Menu.Item key={statusOption}>
                {({ active }) => (
                  <button
                    className={getMenuItemClasses(active)}
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
        className={getDeleteButtonClasses()}
        label=""
        onClick={() => onClickDeleteAnime(entry.anime?.id || "")}
        icon={<FontAwesomeIcon icon={faTrash} className="text-white w-3 h-3"/>}
        color={ButtonColor.red}
        showLabel={false}
      />
    </div>
  );
}
