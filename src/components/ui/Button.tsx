import React from 'react';
import { motion } from 'framer-motion';
import { Loader } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

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
  const getVariantClasses = (): string => {
    switch (variant) {
      case 'primary':
        return 'bg-primary hover:bg-primary-dark text-white';
      case 'secondary':
        return 'bg-light-gray/20 text-light-text hover:bg-light-gray/30 border border-light-gray/30';
      case 'outline':
        return 'border border-primary/30 dark:border-primary-dark/30 text-primary hover:bg-primary/5';
      case 'danger':
        return 'bg-red-500 hover:bg-red-600 text-white shadow-sm';
      case 'success':
        return 'bg-green-500 hover:bg-green-600 text-white shadow-sm';
      case 'ghost':
        return 'text-primary hover:bg-light-gray/20';
      default:
        return 'bg-primary hover:bg-primary-dark text-white shadow-sm';
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

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
      disabled={isLoading || disabled}
      className={`
        inline-flex items-center justify-center
        rounded-xl font-medium transition-all
        focus:outline-none focus:ring-2 focus:ring-primary/20
        disabled:opacity-50 disabled:cursor-not-allowed
        ${getVariantClasses()} 
        ${getSizeClasses()}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
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