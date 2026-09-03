import {
  GetAnimeDetailsByIdDocument,
  GetAnimeDetailsBySlugDocument,
  GetAnimeNewsByIdDocument,
  GetAnimeNewsBySlugDocument,
  GetWorksOverviewDocument,
  GetWorksByTypeDocument
} from '../../../gql/graphql';

// getAnimeDetailsBySlug is a hand-maintained copy of getAnimeDetailsByID that
// resolves by slug. Nothing in the type system ties the two together, and the
// last time this selection set was duplicated by hand the copy quietly lost
// userAnime.episodes -- a field the page reads, so the bug surfaced as "not on
// your list" rather than as anything that looked like a query problem.
//
// Comparing the shapes here means the next divergence fails in CI instead.

type Node = {
  kind: string;
  name?: { value: string };
  // Aliased fields are named by their alias, not the field they resolve. The
  // work shelves are three aliases of one `works` field, so matching on `name`
  // alone finds the same node three times and never the one asked for.
  alias?: { value: string };
  selectionSet?: { selections: Node[] };
};

/** What a selection is called in the response: its alias, else its field name. */
const nameOf = (sel: Node): string | undefined => sel.alias?.value ?? sel.name?.value;

/** Field tree of a document, as `parent.child` paths, sorted and deduped. */
function fieldPaths(doc: unknown, root: string): string[] {
  const out: string[] = [];
  const walk = (selections: Node[], prefix: string) => {
    for (const sel of selections) {
      const name = nameOf(sel);
      if (sel.kind !== 'Field' || !name) continue;
      const path = prefix ? `${prefix}.${name}` : name;
      out.push(path);
      if (sel.selectionSet) walk(sel.selectionSet.selections, path);
    }
  };
  const op = (doc as { definitions: Node[] }).definitions[0];
  const top = op.selectionSet!.selections.find((s) => nameOf(s) === root)!;
  walk(top.selectionSet!.selections, '');
  return [...new Set(out)].sort();
}

describe('anime detail queries', () => {
  it('by-slug selects exactly the same fields as by-id', () => {
    const byId = fieldPaths(GetAnimeDetailsByIdDocument, 'anime');
    const bySlug = fieldPaths(GetAnimeDetailsBySlugDocument, 'animeBySlug');

    expect(bySlug).toEqual(byId);
  });

  it('news by-slug selects exactly the same fields as news by-id', () => {
    expect(fieldPaths(GetAnimeNewsBySlugDocument, 'animeBySlug')).toEqual(
      fieldPaths(GetAnimeNewsByIdDocument, 'anime')
    );
  });

  it('both select the fields the show page depends on', () => {
    // Spot-check the ones whose absence degrades silently rather than crashing.
    for (const doc of [
      fieldPaths(GetAnimeDetailsByIdDocument, 'anime'),
      fieldPaths(GetAnimeDetailsBySlugDocument, 'animeBySlug')
    ]) {
      expect(doc).toContain('slug');
      expect(doc).toContain('userAnime.episodes');
      expect(doc).toContain('episodes.episodeNumber');
    }
  });
});

describe('work browse queries', () => {
  // getWorksOverview asks for the same card fields three times over, once per
  // aliased sort, and getWorksByType asks for them a fourth time. Four
  // hand-maintained copies of one selection set is exactly the shape that lost
  // userAnime.episodes above, and it would fail the same way here: a shelf
  // quietly missing score or publishedFrom renders cards with a blank subtitle
  // rather than an error anyone would chase.
  const aliases = ['popular', 'rated', 'newest'] as const;

  it('every shelf in the overview selects the same fields', () => {
    const [popular, ...rest] = aliases.map((a) =>
      fieldPaths(GetWorksOverviewDocument, a)
    );

    for (const shelf of rest) {
      expect(shelf).toEqual(popular);
    }
  });

  it('the paged query selects the same work fields as the shelves', () => {
    const shelf = fieldPaths(GetWorksOverviewDocument, 'popular');
    const paged = fieldPaths(GetWorksByTypeDocument, 'works');

    // The paged query additionally carries page and perPage, which the shelves
    // have no pager to spend them on.
    expect(paged).toEqual([...shelf, 'page', 'perPage'].sort());
  });

  it('selects the fields a card and its link depend on', () => {
    // urlSlug in particular: a work without one is filtered out of the grid, so
    // dropping the field would empty every shelf rather than break loudly.
    for (const doc of [
      fieldPaths(GetWorksOverviewDocument, 'popular'),
      fieldPaths(GetWorksByTypeDocument, 'works')
    ]) {
      expect(doc).toContain('total');
      expect(doc).toContain('works.urlSlug');
      expect(doc).toContain('works.titleEn');
      expect(doc).toContain('works.type');
      expect(doc).toContain('works.publishedFrom');
    }
  });
});
