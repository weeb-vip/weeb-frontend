interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void

  style: React.CSSProperties | undefined
}

function Card({children, className, style, onClick}: CardProps) {
  return (
    <div className={`${className}`} onClick={onClick} {...{style}}>
      {children}
    </div>
  )
}

export {Card as default}
export type {CardProps}