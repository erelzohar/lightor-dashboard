import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string | JSX.Element;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    fullWidth = true,
    className = '',
    ...props
  }, ref) => {
    const inputClasses = 
      "px-4 py-3 rounded-xl border text-[15px] " +
      "focus:outline-none focus:ring-[3px] " +
      "transition-all duration-300 shadow-sm " +
      "bg-white dark:bg-dark-surface dark:border-gray-700/80 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 " +
      (error 
        ? 'border-red-300 dark:border-red-500/50 focus:border-red-500 focus:ring-red-500/20 ' 
        : 'border-gray-200 focus:border-primary focus:ring-primary/20 ') +
      (leftIcon ? 'ps-11 ' : '') +
      (rightIcon ? 'pe-11 ' : '') +
      (fullWidth ? 'w-full ' : '') +
      className;

    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${props.disabled ? 'opacity-60' : ''}`}>
        {label && (
          <label htmlFor={props.id} className="block text-[14px] font-medium text-gray-700 dark:text-gray-300 mb-2 ms-0.5">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none text-gray-400 dark:text-gray-500">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            className={inputClasses}
            {...props}
          />

          {rightIcon && (
            <div className="absolute inset-y-0 end-0 flex items-center pe-4 text-gray-400 dark:text-gray-500">
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        )}

        {helperText && !error && (
          <p className="mt-1 text-sm text-light-gray">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;