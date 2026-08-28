import React from 'react';

interface EventPropertyRowProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export const EventPropertyRow: React.FC<EventPropertyRowProps> = ({
  label,
  children,
  className,
}) => {
  return (
    <div className={`event-property-row${className ? ` ${className}` : ''}`}>
      <div className="row-label">{label}</div>
      <div className="row-value">{children}</div>
    </div>
  );
};
