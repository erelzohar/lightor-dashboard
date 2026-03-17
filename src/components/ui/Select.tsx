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
      "px-4 py-2 rounded-md border " +
      "focus:outline-none focus:ring-2 focus:border-transparent " +
      "transition-all duration-200 " +
      "bg-light-surface text-light-text " +
      (error
        ? "border-red-500 focus:ring-red-500 "
        : "border-light-gray focus:ring-primary dark:ring-primary-dark ") +
      (leftIcon ? "pl-10 " : "") +
      (rightIcon ? "pr-10 " : "") +
      (fullWidth ? "w-full " : "") +
      className +
      " ";

    return (
      <div
        className={`${fullWidth ? "w-full" : ""} ${props.disabled ? "opacity-60" : ""
          }`}
      >
        {label && (
          <label
            htmlFor={props.id}
            className="block text-sm font-medium text-light-text mb-1"
          >
            {label}
          </label>
        )}

        <div className="relative flex justify-center">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-6 pointer-events-none text-light-gray">
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

          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-light-gray pointer-events-none">
              {rightIcon}
            </div>
          )}
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
