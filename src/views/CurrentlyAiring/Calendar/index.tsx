import React, {useState, useMemo} from "react";
import {useQuery} from "@tanstack/react-query";
import {fetchCurrentlyAiring, fetchCurrentlyAiringWithDates} from "../../../services/queries";
import {CurrentlyAiringQuery} from "../../../gql/graphql";
import Loader from "../../../components/Loader";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import {utc} from "@date-fns/utc/utc";
import {AnimePopover} from "./AnimePopover";

export default function AiringCalendarPage() {

  const [currentMonth, setCurrentMonth] = useState(new Date());


  const start = startOfWeek(startOfMonth(currentMonth), {weekStartsOn: 0});
  const end = endOfWeek(endOfMonth(currentMonth), {weekStartsOn: 0});
  const days = eachDayOfInterval({start, end});
  console.log("START", start);
  console.log("END", end);
  const { data, isLoading } = useQuery<CurrentlyAiringQuery>(
    ["currentlyAiring", start.toISOString(), end.toISOString()], // ← key includes dates
    () => fetchCurrentlyAiringWithDates(start, end).queryFn()
  );
  if (isLoading || !data) return <Loader/>;


  const animeByDate: Record<string, typeof data.currentlyAiring> = {};
  for (const anime of data.currentlyAiring || []) {
    const airDate = anime.nextEpisode?.airDate;
    if (!airDate) continue;
    const key = format(parseISO(airDate, {in: utc}), "yyyy-MM-dd", {in: utc});
    if (!animeByDate[key]) animeByDate[key] = [];
    animeByDate[key]?.push(anime);
  }

  const isTodayVisible = (day: Date) =>
    currentMonth.getMonth() === new Date().getMonth() &&
    isSameDay(day, new Date());

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 relative">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Previous
        </button>
        <h1 className="text-2xl font-bold">
          {format(currentMonth, "MMMM yyyy")}
        </h1>
        <button
          onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
          className="text-sm text-blue-600 hover:underline"
        >
          Next →
        </button>
      </div>

      <div
        className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-300 rounded-lg overflow-hidden text-sm relative z-0">
        {/* Day headers */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="bg-gray-50 py-3 text-center font-medium text-gray-700 border-b border-gray-200"
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd", {in: utc});
          const entries = animeByDate[dateKey] || [];
          const isToday = isTodayVisible(day);

          return (
            <div
              key={dateKey}
              className={`bg-white p-2 h-[140px] flex flex-col justify-start border border-gray-100 ${
                isToday ? "bg-blue-50 ring-2 ring-blue-400" : ""
              }`}
            >
              <div className="text-xs font-semibold text-gray-800 mb-1">
                {format(day, "d", {in: utc})}
              </div>
              <div
                className="flex flex-col gap-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent pr-1">
                {entries.map((anime) => {
                  return <AnimePopover anime={anime} key={anime.id}/>
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
