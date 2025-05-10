import React from 'react';
import type {Meta, StoryObj} from '@storybook/react';
import {fn} from '@storybook/test';


import Card, {CardProps} from "../components/Card";
import Button from "../components/Button";


// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Example/Card',
  component: Card,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: 'centered',
  },

} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;



// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Primary: { args: CardProps } = {
  args: {
      children: <h1>Card</h1>,
      onClick: fn(),
    className: 'flex flex-col gap-2 items-center justify-center border-2 border-black p-4',
    style: {

    }

  },
};

