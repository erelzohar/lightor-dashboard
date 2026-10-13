import React from 'react';
import { Toggle } from './liquid-toggle';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  /** The switch's accessible name when the visible text sits outside it. */
  ariaLabel?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * The dashboard's switch, with an optional label beside it — drawn by the
 * liquid toggle since LT-311 (same props as before, so no caller changed).
 * Logical spacing: the label sits after the switch in either direction.
 */
const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label, ariaLabel, disabled = false, size = 'md' }) => {
  const toggle = (
    <Toggle checked={checked} onCheckedChange={onChange} disabled={disabled} size={size} aria-label={ariaLabel} />
  );
  if (!label) return <div className="flex items-center">{toggle}</div>;
  return (
    <label className={`flex items-center gap-3 ${disabled ? '' : 'cursor-pointer'}`}>
      {toggle}
      <span className={`text-sm font-medium text-light-text dark:text-dark-text ${disabled ? 'opacity-50' : ''}`}>{label}</span>
    </label>
  );
};

export default ToggleSwitch;
