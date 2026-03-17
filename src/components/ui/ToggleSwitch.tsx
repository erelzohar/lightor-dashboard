import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md'
}) => {
  const { direction } = useTheme();

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          track: 'w-8 h-4',
          thumb: 'w-3 h-3',
          translateX: 16 // 4 * 4px (w-4 difference)
        };
      case 'md':
        return {
          track: 'w-11 h-6',
          thumb: 'w-5 h-5',
          translateX: 22 // 5 * 4px (w-5 difference)
        };
      case 'lg':
        return {
          track: 'w-14 h-7',
          thumb: 'w-6 h-6',
          translateX: 28 // 7 * 4px (w-7 difference)
        };
    }
  };

  const sizeClasses = getSizeClasses();

  // Calculate the correct translation based on direction and state
  const getTranslateX = () => {
    if (direction === 'rtl') {
      // In RTL, when checked, move to the left (negative value)
      return checked ? -sizeClasses.translateX : 0;
    } else {
      // In LTR, when checked, move to the right (positive value)
      return checked ? sizeClasses.translateX : 0;
    }
  };

  return (
    <div className={`flex items-center ${direction === 'rtl' ? 'flex-row-reverse' : ''}`}>
      <button
        type="button"
        className={`
          relative inline-flex ${sizeClasses.track} items-center rounded-full
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/30
          ${checked 
            ? 'bg-primary' 
            : 'bg-light-gray'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        aria-checked={checked}
        role="switch"
        dir={direction}
      >
        <motion.span
          className={`
            ${sizeClasses.thumb} inline-block rounded-full bg-white shadow-lg
            transform transition-transform duration-200 ease-in-out
          `}
          animate={{
            x: getTranslateX()
          }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
      
      {label && (
        <span className={`${direction === 'rtl' ? 'mr-3' : 'ml-3'} text-sm font-medium text-light-text dark:text-dark-text ${disabled ? 'opacity-50' : ''}`}>
          {label}
        </span>
      )}
    </div>
  );
};

export default ToggleSwitch;