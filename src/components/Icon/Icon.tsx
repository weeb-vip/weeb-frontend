import React from 'react'
import styled from 'styled-components'
import { IIconProps } from './interfaces'

const Icon = ({
  size,
  component,
  className,
  ...rest
}: IIconProps) => {
  const PassedComponent = component
  return (
    <div className={className}>
      <PassedComponent viewBox={size} {...rest} />
    </div>
  )
}

const StyledIcon = styled(Icon)`
  width: ${(props) => props.size || 24}px;
  height: ${(props) => props.size || 24}px;
  * {
    stroke: ${(props) => props.color || '#000'};
    height: 100%;
  }
`
export default StyledIcon
