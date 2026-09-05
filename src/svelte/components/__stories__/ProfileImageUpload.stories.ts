import type { Meta, StoryObj } from '@storybook/svelte';
import ProfileImageUpload from '../ProfileImageUpload.svelte';
import {
  ProfileImageUploadBloc,
  type ProfileImageVariant,
  type QueryCachePort,
} from '../ProfileImageUpload.bloc.svelte';

/** The query client, as the two writes this makes. Nothing is cached here. */
const stubCache: QueryCachePort = {
  setQueryData: (key, updater) => console.log('setQueryData', key, updater({})),
  invalidateQueries: (filters) => console.log('invalidateQueries', filters),
};

/** A gradient, as a data URL, so no story waits on the network. */
function sampleImage(width: number, height: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6d5cff"/><stop offset="100%" stop-color="#c14bd8"/>
    </linearGradient></defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function bloc(
  variant: ProfileImageVariant,
  options: { upload?: () => Promise<any> } = {}
) {
  const upload =
    options.upload ?? (async () => ({ profileImageUrl: 'https://example.test/new.jpg' }));
  return new ProfileImageUploadBloc(
    { variant, cache: stubCache, onClose: () => console.log('close') },
    {
      uploads: { avatar: upload, banner: upload },
      // A fixed viewport, so the preview is fitted the same way every time.
      viewport: () => ({ width: 1200, height: 900 }),
      delay: (callback) => callback(),
    }
  );
}

/**
 * Puts a picture into the cropper without going through a FileReader: the
 * bloc's own fit-and-centre runs, so the frame and the readout are the ones
 * the real flow produces -- synchronously, so a story can then zoom it.
 */
function withPicture(instance: ProfileImageUploadBloc, width: number, height: number) {
  instance.useImage(sampleImage(width, height), { width, height });
  return instance;
}

const meta = {
  title: 'Composites/Profile/ProfileImageUpload',
  component: ProfileImageUpload,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ProfileImageUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The empty dropzone, which is what opens first. */
export const Empty: Story = {
  args: {
    isOpen: true,
    variant: 'avatar',
    bloc: bloc('avatar'),
  },
};

/** A file is being dragged over the dropzone. */
export const DragActive: Story = {
  args: {
    isOpen: true,
    variant: 'avatar',
    bloc: (() => {
      const instance = bloc('avatar');
      instance.setDragActive(true);
      return instance;
    })(),
  },
};

/** The banner variant: the same interaction, framing a 4:1 strip. */
export const BannerEmpty: Story = {
  args: {
    isOpen: true,
    variant: 'banner',
    bloc: bloc('banner'),
  },
};

/** A picture loaded: the circular avatar frame, the guides, and the zoom rail. */
export const AvatarFraming: Story = {
  args: {
    isOpen: true,
    variant: 'avatar',
    bloc: withPicture(bloc('avatar'), 1200, 1600),
  },
};

/** The same for a banner, where the frame is a strip with rule-of-thirds guides. */
export const BannerFraming: Story = {
  args: {
    isOpen: true,
    variant: 'banner',
    bloc: withPicture(bloc('banner'), 2000, 1200),
  },
};

/** Zoomed all the way in: the smallest allowed box, and the kept resolution halves. */
export const ZoomedIn: Story = {
  args: {
    isOpen: true,
    variant: 'avatar',
    bloc: (() => {
      const instance = withPicture(bloc('avatar'), 1200, 1600);
      instance.setZoom(100);
      return instance;
    })(),
  },
};

/**
 * The source is smaller than the variant's minimum, so it is refused with the
 * measurement rather than silently upscaled into a blurry avatar.
 */
export const TooSmall: Story = {
  args: {
    isOpen: true,
    variant: 'avatar',
    bloc: withPicture(bloc('avatar'), 120, 120),
  },
};

/** The upload failed; the message is the one the viewer actually sees. */
export const UploadFailed: Story = {
  args: {
    isOpen: true,
    variant: 'avatar',
    bloc: withPicture(
      bloc('avatar', {
        upload: async () => {
          throw new Error('the server said no');
        },
      }),
      1200,
      1600
    ),
  },
};
