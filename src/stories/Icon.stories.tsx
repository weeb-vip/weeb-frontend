import React from 'react'
import { ComponentStory, ComponentMeta } from '@storybook/react'

import { Icon } from '../components/Icon'
import AlertCircleIcon from '../../public/assets/icons/Alert-Circle.svg'
import ArrowDownIcon from '../../public/assets/icons/Arrow down.svg'
import ArrowUpIcon from '../../public/assets/icons/Arrow up.svg'
import ArrowRightIcon from '../../public/assets/icons/Arrow_Right.svg'
import CloseIcon from '../../public/assets/icons/Close.svg'
import CopyIcon from '../../public/assets/icons/Copy.svg'
import DeleteIcon from '../../public/assets/icons/Delete.svg'
import ExternalUrlIcon from '../../public/assets/icons/External URL.svg'
import FileIcon from '../../public/assets/icons/File.svg'
import HelpCircleIcon from '../../public/assets/icons/Help-Circle.svg'
import HomeIcon from '../../public/assets/icons/Home.svg'
import MagnifyingGlassIcon from '../../public/assets/icons/Magnifying Glass.svg'
import MoreIcon from '../../public/assets/icons/More.svg'
import PaperclipIcon from '../../public/assets/icons/Paperclip.svg'
import PowerIcon from '../../public/assets/icons/Power.svg'
import ScheduleIcon from '../../public/assets/icons/Schedule.svg'
import SettingsIcon from '../../public/assets/icons/Settings.svg'
import SlidersIcon from '../../public/assets/icons/Sliders.svg'

export default {
  title: 'Example/Icon',
  component: Icon,
  argTypes: {
    color: { control: 'color' },
    size: { control: 'number' },
  },
} as ComponentMeta<typeof Icon>

const Template: ComponentStory<typeof Icon> = (args) => <Icon {...args} />
export const AlertCircle = Template.bind({})
AlertCircle.args = {
  component: AlertCircleIcon,
}

export const ArrowDown = Template.bind({})
ArrowDown.args = {
  component: ArrowDownIcon,
}

export const ArrowUp = Template.bind({})
ArrowUp.args = {
  component: ArrowUpIcon,
}

export const ArrowRight = Template.bind({})
ArrowRight.args = {
  component: ArrowRightIcon,
}

export const Close = Template.bind({})
Close.args = {
  component: CloseIcon,
}

export const Copy = Template.bind({})
Copy.args = {
  component: CopyIcon,
}

export const Delete = Template.bind({})
Delete.args = {
  component: DeleteIcon,
}

export const ExternalUrl = Template.bind({})
ExternalUrl.args = {
  component: ExternalUrlIcon,
}

export const File = Template.bind({})
File.args = {
  component: FileIcon,
}

export const HelpCircle = Template.bind({})
HelpCircle.args = {
  component: HelpCircleIcon,
}

export const Home = Template.bind({})
Home.args = {
  component: HomeIcon,
}

export const MagnifyingGlass = Template.bind({})
MagnifyingGlass.args = {
  component: MagnifyingGlassIcon,
}

export const More = Template.bind({})
More.args = {
  component: MoreIcon,
}

export const Paperclip = Template.bind({})
Paperclip.args = {
  component: PaperclipIcon,
}

export const Power = Template.bind({})
Power.args = {
  component: PowerIcon,
}

export const Schedule = Template.bind({})
Schedule.args = {
  component: ScheduleIcon,
}

export const Settings = Template.bind({})
Settings.args = {
  component: SettingsIcon,
}

export const Sliders = Template.bind({})
Sliders.args = {
  component: SlidersIcon,
}
