import React from 'react';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label: string;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange, label }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  
  // Toggle color picker popup
  const togglePicker = () => setIsOpen(!isOpen);

  // Close picker when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.color-picker-container')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="mb-4 relative color-picker-container">
      <label className="block text-sm font-medium text-light-text mb-1">
        {label}
      </label>
      
      <div className="flex items-center">
        <div 
          className="w-10 h-10 rounded-md cursor-pointer border border-light-gray shadow-sm"
          style={{ backgroundColor: color }}
          onClick={togglePicker}
          aria-label={`Select color for ${label}`}
        />
        
        <input
          type="text"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="ml-3 px-3 py-2 border border-light-gray rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent w-32"
          pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
          title="Hexadecimal color code (e.g. #ff0000)"
        />
      </div>
      
      {isOpen && (
        <div className="absolute z-10 mt-2">
          <HexColorPicker color={color} onChange={onChange} />
        </div>
      )}
    </div>
  );
};

export default ColorPicker;