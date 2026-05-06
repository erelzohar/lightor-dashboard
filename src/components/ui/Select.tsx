import React, { forwardRef } from "react";

export interface SelectOption {
  label: string | JSX.Element;
  value: string | number;
}

interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string | JSX.Element;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  options: SelectOption[];
  fullWidth?: boolean;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      options,
      fullWidth = true,
      className = "",
      ...props
    },
    ref
  ) => {
    const selectClasses =
      "px-4 py-3 rounded-xl border text-base sm:text-[0.9375rem] appearance-none " +
      "focus:outline-none focus:ring-[0.1875rem] " +
      "transition-all duration-300 shadow-sm " +
      "bg-white dark:bg-dark-surface dark:border-gray-700/80 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 " +
      (error
        ? 'border-red-300 dark:border-red-500/50 focus:border-red-500 focus:ring-red-500/20 ' 
        : 'border-gray-200 focus:border-primary focus:ring-primary/20 ') +
      (leftIcon ? "pl-11 " : "") +
      (rightIcon ? "pr-11 " : "pr-10 ") +
      (fullWidth ? "w-full " : "") +
      className;

    return (
      <div
        className={`${fullWidth ? "w-full" : ""} ${props.disabled ? "opacity-60" : ""
          }`}
      >
        {label && (
          <label
            htmlFor={props.id}
            className="block text-[0.875rem] font-medium text-gray-700 dark:text-gray-300 mb-2 ms-0.5"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 dark:text-gray-500">
              {leftIcon}
            </div>
          )}

          <select ref={ref} className={selectClasses} {...props}>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Custom Chevron icon */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400 dark:text-gray-500">
            {rightIcon || (
              <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        )}

        {helperText && !error && (
          <p className="mt-1 text-sm text-light-gray">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;
