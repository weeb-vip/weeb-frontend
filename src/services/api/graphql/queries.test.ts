import {
  GetAnimeDetailsByIdDocument,
  GetAnimeDetailsBySlugDocument,
  GetAnimeNewsByIdDocument,
  GetAnimeNewsBySlugDocument
} from '../../../gql/graphql';

// getAnimeDetailsBySlug is a hand-maintained copy of getAnimeDetailsByID that
// resolves by slug. Nothing in the type system ties the two together, and the
// last time this selection set was duplicated by hand the copy quietly lost
// userAnime.episodes -- a field the page reads, so the bug surfaced as "not on
// your list" rather than as anything that looked like a query problem.
//
// Comparing the shapes here means the next divergence fails in CI instead.

type Node = { kind: string; name?: { value: string }; selectionSet?: { selections: Node[] } };

/** Field tree of a document, as `parent.child` paths, sorted and deduped. */
function fieldPaths(doc: unknown, root: string): string[] {
  const out: string[] = [];
  const walk = (selections: Node[], prefix: string) => {
    for (const sel of selections) {
      if (sel.kind !== 'Field' || !sel.name) continue;
      const path = prefix ? `${prefix}.${sel.name.value}` : sel.name.value;
      out.push(path);
      if (sel.selectionSet) walk(sel.selectionSet.selections, path);
    }
  };
  const op = (doc as { definitions: Node[] }).definitions[0];
  const top = op.selectionSet!.selections.find((s) => s.name?.value === root)!;
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
