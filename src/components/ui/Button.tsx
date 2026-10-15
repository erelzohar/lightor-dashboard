import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Loader } from 'lucide-react';
import { pop, type PopColor } from './pop-button';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

// The filled variants wear the pop look (LT-363): a darker edge, a lip, a press.
const POP_VARIANTS: Partial<Record<ButtonVariant, PopColor>> = {
  primary: 'primary',
  danger: 'danger',
  success: 'success',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}) => {
  const popColor = POP_VARIANTS[variant];
  const getVariantClasses = (): string => {
    if (popColor) return pop(popColor);
    switch (variant) {
      case 'secondary':
        return 'bg-light-gray/20 text-light-text hover:bg-light-gray/30 border border-light-gray/30';
      case 'outline':
        return 'border border-primary/30 dark:border-primary-dark/30 text-primary hover:bg-primary/5';
      case 'ghost':
        return 'text-primary hover:bg-light-gray/20';
      default:
        return pop('primary');
    }
  };

  const getSizeClasses = (): string => {
    switch (size) {
      case 'sm':
        return 'py-1.5 px-3 text-sm';
      case 'md':
        return 'py-2 px-5 text-base';
      case 'lg':
        return 'py-3 px-8 text-lg';
      default:
        return 'py-2 px-5 text-base';
    }
  };

  // Colours only, never `transition-all` (LT-351): a loading button grows by
  // its spinner while it and its neighbours fade to disabled, and iPhone
  // Safari left the old paint behind — a second "קבע" and the tail of
  // "ביטול" beside the button. Disabled now dims at once. A pop button
  // transitions colours, its lip and its press only (LT-363), and has no
  // framer scale: an inline transform would cancel the press.
  return (
    <motion.button
      whileTap={popColor ? undefined : { scale: 0.98 }}
      whileHover={popColor ? undefined : { scale: 1.01 }}
      transition={{ duration: 0.2 }}
      disabled={isLoading || disabled}
      className={`
        inline-flex items-center justify-center
        rounded-xl font-medium ${popColor ? '' : 'transition-colors'}
        focus:outline-none focus:ring-2 focus:ring-primary/20
        disabled:opacity-50 disabled:cursor-not-allowed
        ${getVariantClasses()} 
        ${getSizeClasses()}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...(props as unknown as HTMLMotionProps<'button'>)}
    >
      {isLoading ? (
        <Loader size={size === 'sm' ? 14 : size === 'md' ? 18 : 22} className="animate-spin me-2" />
      ) : leftIcon ? (
        <span className="me-2">{leftIcon}</span>
      ) : null}
      {children}
      {rightIcon && !isLoading && <span className="ms-2">{rightIcon}</span>}
    </motion.button>
  );
};

export default Button;