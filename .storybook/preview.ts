import type { Preview } from "storybook";
import '../src/styles/design-tokens.css';
import '../src/scss/base.scss';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'weeb-dark',
      values: [
        { name: 'weeb-dark', value: 'oklch(14% 0.015 275)' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
