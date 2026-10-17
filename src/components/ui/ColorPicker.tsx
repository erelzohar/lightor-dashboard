import React, { useId, useState } from 'react';
import AppleColorPicker from './apple-color-picker';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label: string;
}

/**
 * LT-384: a colour field is a round swatch of the colour itself (Erel: no
 * hex box beside it); a tap opens the colour picker (`apple-color-picker`),
 * which changes it live. Its label sits above it as a Select's does, so the
 * two line up in one row.
 */
const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange, label }) => {
  const [open, setOpen] = useState(false);
  const labelId = `${useId()}-label`;
  return (
    <div className="shrink-0">
      <span id={labelId} className="block text-[0.875rem] font-medium text-gray-700 dark:text-gray-300 mb-2 ms-0.5">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-labelledby={labelId}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="color-swatch"
        className="block w-[50px] h-[50px] rounded-full border-4 border-white dark:border-slate-700 shadow-md ring-1 ring-gray-200 dark:ring-slate-600 transition-transform active:scale-95 focus:outline-none focus-visible:ring-[0.1875rem] focus-visible:ring-primary/40"
        style={{ backgroundColor: color }}
      />
      <AppleColorPicker isOpen={open} onClose={() => setOpen(false)} initialColor={color} onChange={onChange} />
    </div>
  );
};

export default ColorPicker;
