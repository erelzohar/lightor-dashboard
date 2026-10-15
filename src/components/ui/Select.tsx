import React, { forwardRef, useId } from "react";
import Dropdown from "./dropdown";

export interface SelectOption {
  label: string | JSX.Element;
  value: string | number;
  /** Shown but not selectable (LT-178: a second address question). */
  disabled?: boolean;
}

/** What `onChange` gets: the shape of a select's change event that callers read. */
export interface SelectChange {
  target: { value: string; name?: string };
}

interface SelectProps {
  id?: string;
  name?: string;
  value?: string | number;
  onChange?: (e: SelectChange) => void;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  label?: string | JSX.Element;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  options: SelectOption[];
  fullWidth?: boolean;
  /** Classes for the box itself (as the native select had them). */
  className?: string;
}

/**
 * LT-365: every select box in the dashboard is the animated dropdown
 * (`ui/dropdown`), behind the API the native select had: `value`, `options`,
 * and `onChange(e)` with `e.target.value` a string, so no caller changed.
 */
const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      id,
      name,
      value,
      onChange,
      disabled,
      placeholder,
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedBy,
      label,
      error,
      helperText,
      leftIcon,
      options,
      fullWidth = true,
      className = "",
    },
    ref
  ) => {
    const auto = useId();
    const triggerId = id ?? `${auto}-select`;
    const labelId = `${triggerId}-label`;
    // LT-362: as in Input, the label and messages belong to the field.
    const errorId = `${triggerId}-error`;
    const helperId = `${triggerId}-helper`;
    const describedBy = [ariaDescribedBy, error ? errorId : helperText ? helperId : undefined].filter(Boolean).join(" ") || undefined;
    const items = options.map((opt) => ({
      value: String(opt.value),
      label: opt.label,
      disabled: opt.disabled,
    }));

    return (
      <div className={`${fullWidth ? "w-full" : ""} ${disabled ? "opacity-60" : ""}`}>
        {label && (
          <label
            id={labelId}
            htmlFor={triggerId}
            className="block text-[0.875rem] font-medium text-gray-700 dark:text-gray-300 mb-2 ms-0.5"
          >
            {label}
          </label>
        )}

        <Dropdown
          ref={ref}
          id={triggerId}
          labelledBy={label ? labelId : undefined}
          ariaLabel={ariaLabel}
          describedBy={describedBy}
          items={items}
          value={value === undefined ? undefined : String(value)}
          onChange={(v) => onChange?.({ target: { value: v, name } })}
          disabled={disabled}
          invalid={!!error}
          placeholder={placeholder}
          icon={leftIcon}
          className={className}
          rootClassName={fullWidth ? "w-full" : "inline-block"}
        />

        {error && (
          <p id={errorId} className="mt-1 text-sm text-red-500">{error}</p>
        )}

        {helperText && !error && (
          <p id={helperId} className="mt-1 text-sm text-light-gray">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;
