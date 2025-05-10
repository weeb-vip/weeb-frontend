import type {Meta, StoryObj} from '@storybook/react';

import {fn} from '@storybook/test';
import Modal, {ModalProps} from "../components/Modal";


// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Example/Modal',
  component: Modal,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: 'centered',
  },

} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;


// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const Primary: { args: ModalProps } = {
  args: {
    title: 'Modal',
    children: <h1>This is a modal</h1>,
    isOpen: true,
    closeFn: fn(),
    options: [{
      label: 'Close',
      onClick: fn()
    }]

  },
};

