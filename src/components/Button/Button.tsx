enum ButtonColor {
  blue = 'blue',
  red = 'red',
  transparent = 'transparent',
  none = 'none'
}

interface ButtonProps {
  color: ButtonColor
  showLabel?: boolean
  label: string
  onClick: () => void
  icon?: any
  type?: any
  disabled?: boolean

  className?: string
}

function Button ({color, showLabel, label, onClick, icon, type, disabled, className}: ButtonProps) {
  const colorClasses = {
    blue: `bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`,
    red: `bg-red-600 hover:bg-red-700 focus:ring-red-500`,
    transparent: `bg-transparent hover:bg-gray-100 focus:ring-gray-500 border-gray-300 shadow-sm hover:shadow-md`,
    none: ``
  }
  const textColor = {
    blue: `text-white`,
    red: `text-white`,
    transparent: `text-gray-700`,
    none: ``
  }

  const disabledClasses = {
    blue: `bg-blue-400 hover:bg-blue-400`,
    red: `bg-red-400 hover:bg-red-400`,
    transparent: `bg-gray-400 hover:bg-gray-400`,
    none: ``
  }
  return (
    <button
      onClick={onClick}
      type={type}
      disabled={disabled}
      className={`flex items-center justify-center px-6 py-1 border border-transparent text-sm font-medium rounded-full ${colorClasses[color]} ${textColor[color]} ${className || ''} ${disabled ? `cursor-not-allowed ${disabledClasses[color]}` : 'cursor-pointer'} `}
    >
      {icon}
      {showLabel && <span>{label}</span>}
    </button>
  )
}

export {Button as default, ButtonColor}
export type { ButtonProps }
