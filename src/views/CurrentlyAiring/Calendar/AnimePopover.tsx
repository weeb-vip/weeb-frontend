import { Popover } from "@headlessui/react";
import { useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { CurrentlyAiringQuery } from "../../../gql/graphql";
import AnimeCard, { AnimeCardStyle } from "../../../components/AnimeCard";
import { format } from "date-fns";
import { utc } from "@date-fns/utc/utc";

interface AnimePopoverProps {
  // @ts-ignore
  anime: CurrentlyAiringQuery["currentlyAiring"][number];
}

export function AnimePopover({ anime }: AnimePopoverProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        let left = rect.left + window.scrollX;
        const top = rect.bottom + window.scrollY + 8;

        const panelWidth = 420;
        const screenWidth = window.innerWidth;

        // Clamp left so it doesn't overflow on mobile
        if (left + panelWidth > screenWidth) {
          left = screenWidth - panelWidth - 8; // 8px margin
          if (left < 8) left = 8; // Prevent negative offset
        }

        setPosition({ top, left });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [anime]);

  return (
    <Popover className="relative">
      {({ open }) => (
        <>
          <Popover.Button
            ref={buttonRef}
            onClick={() => {
              const rect = buttonRef.current?.getBoundingClientRect();
              if (!rect) return;

              let left = rect.left + window.scrollX;
              const top = rect.bottom + window.scrollY + 8;
              const panelWidth = 420;
              const screenWidth = window.innerWidth;

              if (left + panelWidth > screenWidth) {
                left = screenWidth - panelWidth - 8;
                if (left < 8) left = 8;
              }

              setPosition({ top, left });
            }}
            title={`${anime.titleEn || anime.titleJp || "Unknown"} (Ep ${anime.nextEpisode?.episodeNumber || "?"})`}
            className="text-xs text-blue-700 text-left truncate hover:bg-blue-100 bg-blue-50 px-2 py-1 rounded transition w-full"
          >
            {anime.titleEn || anime.titleJp || "Unknown"} (Ep {anime.nextEpisode?.episodeNumber || "?"})
          </Popover.Button>

          {open &&
            createPortal(
              <Popover.Panel
                static={false}
                className="z-50 w-[420px] max-w-[95vw] bg-white border border-gray-200 rounded-lg shadow-lg p-3 absolute"
                style={{
                  top: position.top,
                  left: position.left,
                }}
              >
                <AnimeCard
                  style={AnimeCardStyle.EPISODE}
                  forceListLayout={true}
                  title={anime.titleEn || anime.titleJp || "Unknown"}
                  description={anime.description || ""}
                  episodes={anime.episodeCount || 0}
                  episodeLength={
                    anime.duration ? anime.duration.replace(/per.+?$/, "") : "?"
                  }
                  image={`https://cdn.weeb.vip/weeb/${anime.id}`}
                  className="hover:cursor-pointer"
                  onClick={() => (window.location.href = `/show/${anime.id}`)}
                  year={
                    anime.startDate
                      ? new Date(anime.startDate).getFullYear().toString()
                      : "Unknown"
                  }
                  airdate={
                    anime.nextEpisode?.airDate
                      ? format(new Date(anime.nextEpisode.airDate), "EEE MMM do", { in: utc })
                      : "Unknown"
                  }
                  episodeTitle={
                    anime.nextEpisode?.titleEn ||
                    anime.nextEpisode?.titleJp ||
                    "Unknown"
                  }
                  episodeNumber={anime.nextEpisode?.episodeNumber?.toString() || "Unknown"}
                  options={[]}
                />
              </Popover.Panel>,
              document.body
            )}
        </>
      )}
    </Popover>
  );
}
