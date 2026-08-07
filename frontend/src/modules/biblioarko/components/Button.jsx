import { useState, forwardRef } from 'react'
const useAuthStore = () => ({ user: { theme_primary_color: '#000000' } });

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  isLoading = false,
  onClick,
  type = 'button',
  primaryColor,
  ...props
}, ref) => {
  const [isHovered, setIsHovered] = useState(false)
  const { user } = useAuthStore()

  // Use passed primaryColor or fallback to user's theme color from store
  const effectiveColor = primaryColor || user?.theme_primary_color

  const baseClasses = 'font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center'

  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-secondary',
    outline: 'border-2 border-primary text-primary hover:bg-primary/10 focus:ring-primary',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }

  let style = {}

  if (effectiveColor && !disabled) {
    if (variant === 'primary') {
      style = {
        backgroundColor: effectiveColor,
        color: 'white',
        filter: isHovered ? 'brightness(0.9)' : 'none',
        borderColor: effectiveColor,
        '--tw-ring-color': effectiveColor
      }
    } else if (variant === 'outline') {
      style = {
        borderColor: effectiveColor,
        color: isHovered ? 'white' : effectiveColor,
        backgroundColor: isHovered ? effectiveColor : 'transparent',
        '--tw-ring-color': effectiveColor
      }
    }
  }

  const classes = `${baseClasses} ${variants[variant]} ${sizes[size]} ${className} ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''
    }`

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || isLoading}
      onClick={onClick}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  )
})

Button.displayName = 'Button'

export default Button




