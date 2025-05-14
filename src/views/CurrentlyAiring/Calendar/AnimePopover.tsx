import { Popover } from "@headlessui/react";
import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CurrentlyAiringQuery } from "../../../gql/graphql";

interface AnimePopoverProps {
  // @ts-ignore
  anime: CurrentlyAiringQuery["currentlyAiring"][number];
}

export function AnimePopover({ anime }: AnimePopoverProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
      });
    }
  };

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <Popover.Button
            ref={buttonRef}
            onClick={updatePosition}
            title={`${anime.titleEn || anime.titleJp || "Unknown"} (Ep ${anime.nextEpisode?.episodeNumber || "?"})`}
            className="text-xs text-blue-700 text-left truncate hover:bg-blue-100 bg-blue-50 px-2 py-1 rounded transition w-full"
          >
            {anime.titleEn || anime.titleJp || "Unknown"} (Ep {anime.nextEpisode?.episodeNumber || "?"})
          </Popover.Button>

          {open &&
            createPortal(
              <Popover.Panel
                static={false}
                className="z-50 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3 absolute"
                style={{
                  top: position.top,
                  left: position.left,
                }}
              >
                {anime.imageUrl && (
                  <img
                    src={anime.imageUrl}
                    alt="cover"
                    className="w-full h-32 object-cover rounded mb-2"
                  />
                )}
                <div className="font-semibold text-sm truncate">
                  {anime.titleEn || anime.titleJp}
                </div>
                <div className="text-xs text-gray-500">
                  Episode {anime.nextEpisode?.episodeNumber || "?"}
                </div>
                <div className="text-xs text-gray-600 mt-1 line-clamp-3">
                  {anime.synopsis || "No synopsis available."}
                </div>
              </Popover.Panel>,
              document.body
            )}
        </>
      )}
    </Popover>
  );
}
