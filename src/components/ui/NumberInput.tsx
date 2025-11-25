'use client';

import React, { useState, useRef, useEffect } from 'react';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
  showStepper?: boolean;
  error?: string;
  placeholder?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  disabled = false,
  className = '',
  showStepper = true,
  error,
  placeholder,
}) => {
  const [inputValue, setInputValue] = useState<string>(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleIncrement = () => {
    if (disabled) return;
    const newValue = value + step;
    if (max === undefined || newValue <= max) {
      onChange(newValue);
    }
  };

  const handleDecrement = () => {
    if (disabled) return;
    const newValue = value - step;
    if (min === undefined || newValue >= min) {
      onChange(newValue);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    if (val === '' || val === '-') return;

    const numVal = Number(val);
    if (!isNaN(numVal)) {
      let finalValue = numVal;
      if (min !== undefined && numVal < min) finalValue = min;
      if (max !== undefined && numVal > max) finalValue = max;
      onChange(finalValue);
    }
  };

  const handleBlur = () => {
    if (inputValue === '' || inputValue === '-') {
      setInputValue(value.toString());
    } else {
      const numVal = Number(inputValue);
      if (!isNaN(numVal)) {
        let finalValue = numVal;
        if (min !== undefined && numVal < min) finalValue = min;
        if (max !== undefined && numVal > max) finalValue = max;
        setInputValue(finalValue.toString());
        if (finalValue !== value) {
          onChange(finalValue);
        }
      } else {
        setInputValue(value.toString());
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleDecrement();
    }
  };

  const isDecrementDisabled = disabled || (min !== undefined && value <= min);
  const isIncrementDisabled = disabled || (max !== undefined && value >= max);

  return (
    <div className={`${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <div className={`flex items-center ${error ? 'ring-2 ring-red-500' : ''} rounded-md`}>
          {showStepper && (
            <button
              type="button"
              onClick={handleDecrement}
              disabled={isDecrementDisabled}
              className={`
                px-3 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700
                rounded-l-md border border-r-0 border-gray-300 dark:border-gray-600
                hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2
                focus:ring-blue-500 focus:ring-inset transition-colors
                ${isDecrementDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              aria-label="Decrease value"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
          )}

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            className={`
              flex-1 px-3 py-2 text-center bg-white dark:bg-gray-800
              border-y border-gray-300 dark:border-gray-600
              ${!showStepper ? 'border-x rounded-md' : ''}
              text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
              disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:opacity-50
              transition-colors
            `}
            aria-label={label || 'Number input'}
            aria-invalid={!!error}
            aria-describedby={error ? 'number-input-error' : undefined}
          />

          {showStepper && (
            <button
              type="button"
              onClick={handleIncrement}
              disabled={isIncrementDisabled}
              className={`
                px-3 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700
                rounded-r-md border border-l-0 border-gray-300 dark:border-gray-600
                hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2
                focus:ring-blue-500 focus:ring-inset transition-colors
                ${isIncrementDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              aria-label="Increase value"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>

        {error && (
          <p id="number-input-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};