'use client';

import React from 'react';

interface ToggleProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  label,
  checked,
  onChange,
  disabled = false,
  size = 'medium',
  className = '',
}) => {
  const sizeClasses = {
    small: 'w-8 h-4',
    medium: 'w-11 h-6',
    large: 'w-14 h-7',
  };

  const dotSizeClasses = {
    small: 'h-3 w-3',
    medium: 'h-5 w-5',
    large: 'h-6 w-6',
  };

  const dotTranslateClasses = {
    small: checked ? 'translate-x-4' : 'translate-x-0',
    medium: checked ? 'translate-x-5' : 'translate-x-0',
    large: checked ? 'translate-x-7' : 'translate-x-0',
  };

  return (
    <label className={`flex items-center cursor-pointer ${disabled ? 'cursor-not-allowed' : ''} ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          ${sizeClasses[size]}
          relative inline-flex shrink-0 rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2
          focus-visible:ring-blue-500 focus-visible:ring-offset-2
          ${checked ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}
          ${disabled ? 'opacity-50' : ''}
        `}
      >
        <span
          className={`
            ${dotSizeClasses[size]}
            ${dotTranslateClasses[size]}
            pointer-events-none inline-block rounded-full bg-white shadow-lg
            transform ring-0 transition duration-200 ease-in-out
          `}
        />
      </button>
      {label && (
        <span className={`ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 ${disabled ? 'opacity-50' : ''}`}>
          {label}
        </span>
      )}
    </label>
  );
};