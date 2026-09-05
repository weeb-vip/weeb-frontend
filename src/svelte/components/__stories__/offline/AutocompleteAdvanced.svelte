<script lang="ts">
  import AutocompleteAdvanced from '../../AutocompleteAdvanced.svelte';
  import {
    AutocompleteAdvancedBloc,
    type SearchPort,
  } from '../../AutocompleteAdvanced.bloc.svelte';

  /**
   * Storybook's stand-in for the header's search box (see ./README.md).
   *
   * Not a fake input: the real component, driven by the real bloc, with only
   * the Algolia port replaced. The default port initialises the config store
   * over HTTP and stands up a search client; this one connects instantly to a
   * session that answers nothing, so the field is live and typeable and no
   * request leaves the page.
   *
   * `Composites/Navigation/AutocompleteAdvanced` still resolves the real module
   * -- the swap is scoped to Header's import.
   */
  const search: SearchPort = {
    async connect(onState) {
      const state = { query: '', isOpen: false, collections: [] };
      onState(state);

      return {
        setQuery: (query: string) => onState({ ...state, query }),
        refresh: () => {},
        setIsOpen: (isOpen: boolean) => onState({ ...state, isOpen }),
      };
    },
  };

  const bloc = new AutocompleteAdvancedBloc({
    search,
    navigate: () => {},
    analytics: { searchPerformed: () => {} },
  });
</script>

<AutocompleteAdvanced {bloc} />
