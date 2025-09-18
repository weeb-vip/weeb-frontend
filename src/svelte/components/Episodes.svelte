<script lang="ts">
  import { format, isDate } from 'date-fns';

  export let episodes: any[];
  export let broadcast: string | null = null;

  // Sort episodes by episode number
  $: sortedEpisodes = episodes ? [...episodes].sort((a, b) => a.episodeNumber - b.episodeNumber) : [];

  function parseAirTime(airDate: string, broadcast: string): Date | null {
    if (!airDate) return null;
    try {
      // For now, just use the airDate directly since we'd need to import the parseAirTime utility
      return new Date(airDate);
    } catch {
      return null;
    }
  }

  function formatAirdate(episode: any): string {
    if (!episode.airDate) return "TBA";

    const airdate = parseAirTime(episode.airDate, (broadcast && broadcast.toLowerCase() !== "unknown") ? broadcast : "CST");
    return airdate && isDate(airdate) ? format(airdate, 'dd MMM yyyy') : "TBA";
  }
</script>

<div class="flex flex-col flex-grow">
  <div class="inline-block min-w-full overflow-hidden rounded-lg shadow m-auto">
    <div class="flex flex-row flex-grow flex-nowrap p-6 space-x-6 items-center bg-white dark:bg-gray-800 transition-colors duration-300">
      <i class="fas fa-bookmark text-2xl text-gray-600"></i>
      <h1 class="text-left text-2xl font-normal text-gray-900 dark:text-gray-100">Episodes</h1>
    </div>

    <table class="table-auto leading-normal w-full">
      <thead>
        <tr>
          <th
            scope="col"
            class="px-5 py-3 text-base font-normal text-left text-gray-800 dark:text-gray-200 uppercase bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 transition-colors duration-300"
          >
            #
          </th>
          <th
            scope="col"
            class="px-5 py-3 text-base font-normal text-left text-gray-800 dark:text-gray-200 uppercase bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 transition-colors duration-300"
          >
            Name
          </th>
          <th
            scope="col"
            class="px-5 py-3 text-base font-normal text-left text-gray-800 dark:text-gray-200 uppercase bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 transition-colors duration-300"
          >
            Aired
          </th>
        </tr>
      </thead>
      <tbody>
        {#each sortedEpisodes as episode (episode.id)}
          <tr>
            <td class="px-5 py-5 text-base bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 transition-colors duration-300">
              {episode.episodeNumber}
            </td>
            <td class="px-5 py-5 text-base bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 transition-colors duration-300">
              {episode.titleEn || "TBA"}
            </td>
            <td class="px-5 py-5 text-base bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 transition-colors duration-300">
              {formatAirdate(episode)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>