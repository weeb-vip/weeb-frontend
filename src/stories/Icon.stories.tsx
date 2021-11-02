import React from 'react'
import { ComponentStory, ComponentMeta } from '@storybook/react'

import { Icon } from '../components/Icon'
import HomeIcon from '../../public/assets/icons/Home.svg'

export default {
  title: 'Example/Icon',
  component: Icon,
  argTypes: {
    color: { control: 'color' },
    size: { control: 'number' },
  },
} as ComponentMeta<typeof Icon>

const Template: ComponentStory<typeof Icon> = (args) => <Icon {...args} />
export const Home = Template.bind({})
Home.args = {
  component: HomeIcon,
}
