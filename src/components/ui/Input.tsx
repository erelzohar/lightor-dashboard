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
    const inputClasses = "px-4 py-2 rounded-md border " +
      "focus:outline-none focus:ring-2 focus:border-transparent " +
      "transition-all duration-200 " +
      "bg-light-surface text-light-text " +
      (error ? 'border-red-500 focus:ring-red-500 ' : 'border-light-gray focus:ring-primary dark:ring-primary-dark ') +
      (leftIcon ? 'ps-10 ' : '') +
      (rightIcon ? 'pe-10 ' : '') +
      (fullWidth ? 'w-full ' : '') +
      className + " "
      ;

    return (
      <div className={`${fullWidth ? 'w-full' : ''} ${props.disabled ? 'opacity-60' : ''}`}>
        {label && (
          <label htmlFor={props.id} className="block text-sm font-medium text-light-text mb-1.5">
            {label}
          </label>
        )}

        <div className="relative flex justify-center">
          {leftIcon && (
            <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-light-gray">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            className={inputClasses}
            {...props}
          />

          {rightIcon && (
            <div className="absolute inset-y-0 end-0 flex items-center pe-3 text-light-gray">
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