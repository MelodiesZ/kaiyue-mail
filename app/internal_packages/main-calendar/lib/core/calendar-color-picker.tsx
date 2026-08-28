import React, { useState, useRef, useEffect } from 'react';

interface CalendarColorPickerProps {
  color: string; // Current color hex value (e.g., "#d93f35")
  onChange: (color: string) => void; // Callback when color is selected
  colors?: string[]; // Optional custom color palette
}

const DEFAULT_COLORS = [
  '#d93f35', // red
  '#e57c22', // orange
  '#f4c030', // yellow
  '#5eb25e', // green
  '#419bf9', // blue (matches @accent-primary)
  '#7b5db8', // purple
  '#9e9e9e', // gray
  '#795548', // brown
];

export const CalendarColorPicker: React.FC<CalendarColorPickerProps> = ({
  color,
  onChange,
  colors,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const availableColors = colors || DEFAULT_COLORS;

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleColorSelect = (selectedColor: string) => {
    onChange(selectedColor);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  return (
    <div className="calendar-color-picker" ref={containerRef}>
      <button
        type="button"
        className="color-picker-trigger"
        aria-label="选择日历颜色"
        aria-expanded={isOpen}
        onClick={toggleDropdown}
      >
        <div className="color-dot" style={{ backgroundColor: color }} />
        <div className="color-picker-chevron">▾</div>
      </button>
      {isOpen && (
        <div className="color-picker-dropdown">
          {availableColors.map((c) => (
            <button
              type="button"
              key={c}
              className={`color-option ${c === color ? 'selected' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => handleColorSelect(c)}
              aria-label={`颜色 ${c}`}
              aria-pressed={c === color}
            />
          ))}
        </div>
      )}
    </div>
  );
};
