import React from 'react'

export interface IIconProps extends React.Attributes {
  size?: string;
  color?: string;
  component: (props:React.SVGProps<SVGElement>)=>React.ReactElement<string>;
  className?: string;
}
