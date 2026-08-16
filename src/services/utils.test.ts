import { GetImageFromAnime, GetLegacyImageFromAnime, GetImageSourcesFromAnime } from './utils';

const ID = 'f3450266-1eaf-4d9e-8d31-8724a113c8bf';

describe('GetImageFromAnime', () => {
  it('is the anime id', () => {
    expect(GetImageFromAnime({ id: ID, titleEn: 'One Piece' })).toBe(ID);
  });

  it('does not invent a key when there is no id', () => {
    expect(GetImageFromAnime({ titleEn: 'One Piece' })).toBe('not found.png');
    expect(GetImageFromAnime(null)).toBe('not found.png');
  });
});

describe('GetLegacyImageFromAnime', () => {
  it('lowercases and underscores, as the sync services did', () => {
    expect(GetLegacyImageFromAnime({ titleEn: 'One Piece' })).toBe('one_piece');
  });

  it('escapes once — the object is stored under the single-escaped form', () => {
    // getSafeImageUrl encodes once more on top, which is what turns this into
    // the "%253A" that actually resolves. Encoding twice here, or not at all,
    // is what used to 404 for every title with a colon.
    expect(GetLegacyImageFromAnime({ titleEn: 'Azumanga Daioh: The Animation' })).toBe(
      'azumanga_daioh%3A_the_animation'
    );
  });

  it.each([
    ['Steins;Gate', 'steins%3Bgate'],
    ["Steel Ball Run: JoJo's Bizarre Adventure", 'steel_ball_run%3A_jojo%27s_bizarre_adventure'],
    ['Nya Nya Nya Chu Nya (NNNCN)', 'nya_nya_nya_chu_nya_%28nnncn%29'],
    ['Oh Boy, Was I Wrong About Her', 'oh_boy%2C_was_i_wrong_about_her']
  ])('handles %s', (title, expected) => {
    expect(GetLegacyImageFromAnime({ titleEn: title })).toBe(expected);
  });

  it('accepts the snake_case shape Algolia returns', () => {
    expect(GetLegacyImageFromAnime({ title_en: 'One Piece' })).toBe('one_piece');
  });

  it('falls back to the japanese title, as the producers did', () => {
    expect(GetLegacyImageFromAnime({ titleJp: 'Kimi No Na Wa' })).toBe('kimi_no_na_wa');
  });

  it('is empty when there is no title to derive from', () => {
    expect(GetLegacyImageFromAnime({ id: ID })).toBe('');
    expect(GetLegacyImageFromAnime(null)).toBe('');
  });
});

describe('GetImageSourcesFromAnime', () => {
  it('puts the id first and the legacy key second', () => {
    expect(GetImageSourcesFromAnime({ id: ID, titleEn: 'One Piece' })).toEqual([ID, 'one_piece']);
  });

  it('still offers the legacy key when there is no id', () => {
    expect(GetImageSourcesFromAnime({ titleEn: 'One Piece' })).toEqual(['one_piece']);
  });

  it('offers the id alone when there is no title', () => {
    expect(GetImageSourcesFromAnime({ id: ID })).toEqual([ID]);
  });

  it('never returns an empty list', () => {
    // SafeImage races whatever it is handed; an empty list would render nothing
    // at all rather than falling through to its own fallbackSrc.
    expect(GetImageSourcesFromAnime({})).toEqual(['not found.png']);
    expect(GetImageSourcesFromAnime(null)).toEqual(['not found.png']);
  });
});
