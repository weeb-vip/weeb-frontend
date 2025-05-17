import type {Meta, StoryObj} from '@storybook/react';
import {fn} from '@storybook/test';
import AnimeCard, {AnimeCardProps, AnimeCardStyle} from "../components/AnimeCard";


// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Example/AnimeCard',
  component: AnimeCard,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: 'centered',
  },

} satisfies Meta<typeof AnimeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Primary: { args: AnimeCardProps } = {
  args: {
    id: "1",
    style: AnimeCardStyle.DETAIL,
    title: 'Spice and Wolf',
    description: 'Anime Description',
    episodes: 12,
    episodeLength: '24 min',
    year: '2021',
    image: 'https://cdn.weeb.vip/weeb/164a90ec-074e-4855-b086-ce2c98012791',
    onClick: fn(),
    options:[]
  },

};

