import type { Meta, StoryObj } from '@storybook/svelte';
import VoiceActorPage from '../VoiceActorPage.svelte';
import { VoiceActorPageBloc, type RoleEntry, type Staff } from '../VoiceActorPage.bloc.svelte';

function role(id: number, name: string, roleLabel: string, anime: string | null): RoleEntry {
  return {
    character: { id: `char-${id}`, name, role: roleLabel },
    anime: anime
      ? {
          id: `anime-${id}`,
          slug: anime.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          titleEn: anime,
          titleJp: anime,
          startDate: `${2000 + (id % 24)}-04-05`,
        }
      : null,
  };
}

const NAMES = [
  ['Motoko Kusanagi', 'Main', 'Ghost in the Shell: Stand Alone Complex'],
  ['Major Motoko', 'Main', 'Ghost in the Shell: SAC 2nd GIG'],
  ['Cornelia li Britannia', 'Supporting', 'Code Geass'],
  ['Chief Kasumi', 'Supporting', 'Psycho-Pass'],
  ['Riza Hawkeye', 'Main', 'Fullmetal Alchemist'],
  ['Villager B', 'Supporting', 'Naruto'],
  ['Narrator', 'Supporting', 'Mob Psycho 100'],
  ['Ancient One', 'Supporting', null],
];

/** Enough credits that the reveal button has something to reveal. */
const MANY_ROLES: RoleEntry[] = Array.from({ length: 40 }, (_, i) => {
  const [name, label, anime] = NAMES[i % NAMES.length];
  return role(i + 1, `${name}${i >= NAMES.length ? ` (${i})` : ''}`, label as string, anime);
});

const STAFF: Staff = {
  id: 'staff-1',
  givenName: 'Mary Elizabeth',
  familyName: 'McGlynn',
  language: 'English',
  birthday: 'October 16, 1966',
  birthPlace: 'Los Angeles, California',
  bloodType: '',
  hobbies: 'Singing',
  summary:
    'A voice director and singer as well as an actor, credited on several hundred episodes across two decades of dubs.',
  roles: MANY_ROLES,
};

function bloc(staff: Staff | null, ssrError: string | null = null, pageSize = 24) {
  return new VoiceActorPageBloc({ source: () => ({ staff, ssrError }), pageSize });
}

const meta = {
  title: 'Browse/VoiceActorPage',
  component: VoiceActorPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof VoiceActorPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The ordinary page: profile, counts, filters, and the first page of roles. */
export const Populated: Story = {
  args: { staff: STAFF, bloc: bloc(STAFF) },
};

/** A small page size, so the reveal button and its "N left" count are on screen. */
export const Paginated: Story = {
  args: { staff: STAFF, bloc: bloc(STAFF, null, 6) },
};

/** The "Main" filter applied -- the reveal resets with it, by design. */
export const FilteredToMain: Story = {
  args: {
    staff: STAFF,
    bloc: (() => {
      const b = bloc(STAFF, null, 6);
      b.selectFilter('main');
      return b;
    })(),
  },
};

/** Every credit is a lead, so there is no choice to offer and no filter strip. */
export const SingleBucket: Story = {
  args: {
    staff: { ...STAFF, roles: MANY_ROLES.filter((r) => r.character.role === 'Main').slice(0, 4) },
    bloc: bloc({
      ...STAFF,
      roles: MANY_ROLES.filter((r) => r.character.role === 'Main').slice(0, 4),
    }),
  },
};

/** Scraped but with no credits yet: the shared EmptyState under the heading. */
export const NoRoles: Story = {
  args: {
    staff: { ...STAFF, roles: [] },
    bloc: bloc({ ...STAFF, roles: [] }),
  },
};

/** A profile whose scraped fields are the empty strings the scraper writes. */
export const SparseProfile: Story = {
  args: {
    staff: {
      id: 'staff-2',
      givenName: 'Unknown',
      familyName: 'Actor',
      language: '',
      birthday: '',
      birthPlace: '',
      bloodType: '',
      hobbies: '',
      summary: '',
      roles: MANY_ROLES.slice(0, 3),
    },
    bloc: bloc({
      id: 'staff-2',
      givenName: 'Unknown',
      familyName: 'Actor',
      language: '',
      birthday: '',
      birthPlace: '',
      bloodType: '',
      hobbies: '',
      summary: '',
      roles: MANY_ROLES.slice(0, 3),
    }),
  },
};

/** The loader failed: the shared ErrorBanner rather than a bare grey line. */
export const LoadFailed: Story = {
  args: { ssrError: 'staff-api returned 500', bloc: bloc(null, 'staff-api returned 500') },
};

/** Long character names and long anime titles -- both clamp rather than reflow. */
export const LongTitles: Story = {
  args: {
    staff: {
      ...STAFF,
      roles: [
        role(
          1,
          'Cornelia li Britannia, Second Princess of the Holy Empire',
          'Main',
          'The Exiled Heavy Knight Knows How to Game the System and Will Not Return',
        ),
        role(
          2,
          'A Character Whose Scraped Name Simply Kept Going And Going',
          'Supporting',
          'That Time I Got Reincarnated as a Slime, Season Three, Second Cour',
        ),
      ],
    },
    bloc: bloc({
      ...STAFF,
      roles: [
        role(
          1,
          'Cornelia li Britannia, Second Princess of the Holy Empire',
          'Main',
          'The Exiled Heavy Knight Knows How to Game the System and Will Not Return',
        ),
        role(
          2,
          'A Character Whose Scraped Name Simply Kept Going And Going',
          'Supporting',
          'That Time I Got Reincarnated as a Slime, Season Three, Second Cour',
        ),
      ],
    }),
  },
};
