import type {Meta, StoryObj} from '@storybook/react';
import {fn} from '@storybook/test';

import Button, {ButtonColor, ButtonProps} from "../components/Button";


// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Example/Button',
  component: Button,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: 'centered',
  },

} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Primary: { args: ButtonProps } = {
  args: {
    color: ButtonColor.blue,
    label: 'Button',
    showLabel: true,
    onClick: () => {},

  },
};

