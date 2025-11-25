'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
// Custom ChevronDown SVG icon component (no external dependencies)
const ChevronDown = ({ className }: { className?: string }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: string | React.ReactNode;
  description?: string;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  showIcon?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '選択してください',
  disabled = false,
  className = '',
  label,
  showIcon = true,
  onOpenChange,
}) => {
  const [isOpen, setIsOpenState] = useState(false);

  // 状態変更時にコールバックを呼び出すラッパー
  const setIsOpen = useCallback((open: boolean) => {
    setIsOpenState(open);
    onOpenChange?.(open);
  }, [onOpenChange]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // handleSelect関数を先に定義
  const handleSelect = useCallback((optionValue: string) => {
    if (onChange) {
      onChange(optionValue);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
    buttonRef.current?.focus();
  }, [onChange]);

  // 外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  // キーボード操作
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          setIsOpen(false);
          buttonRef.current?.focus();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev < options.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : options.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && options[highlightedIndex]) {
            handleSelect(options[highlightedIndex].value);
          }
          break;
      }
    };

    if (isOpen || document.activeElement === buttonRef.current) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, highlightedIndex, options, handleSelect]);

  const renderOptionContent = (option: CustomSelectOption) => {
    return (
      <>
        {showIcon && option.icon && (
          <span className="mr-2 text-lg flex-shrink-0">
            {typeof option.icon === 'string' ? option.icon : option.icon}
          </span>
        )}
        <div className="flex-1">
          <span className="block">{option.label}</span>
          {option.description && (
            <span className="text-xs text-gray-400 mt-0.5 block">
              {option.description}
            </span>
          )}
        </div>
      </>
    );
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-4 py-3 rounded-xl text-left
          bg-glass-dark backdrop-blur-md
          border border-white/20
          transition-all duration-200
          flex items-center justify-between
          ${!disabled ? 'hover:border-white/30 cursor-pointer' : 'opacity-50 cursor-not-allowed'}
          ${isOpen ? 'border-rpg-accent/50 ring-2 ring-rpg-accent/20' : ''}
          focus:outline-none focus:border-rpg-accent/50 focus:ring-2 focus:ring-rpg-accent/20
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label || 'Select option'}
      >
        <div className="flex items-center flex-1 min-w-0">
          {selectedOption ? (
            renderOptionContent(selectedOption)
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown 
          className={`
            w-5 h-5 text-gray-400 ml-2 flex-shrink-0
            transition-transform duration-200
            ${isOpen ? 'transform rotate-180' : ''}
          `}
        />
      </button>

      {/* ドロップダウンメニュー */}
      {isOpen && (
        <div
          className={`
            absolute z-[99999] w-full mt-2
            bg-gray-900 bg-opacity-95 backdrop-blur-xl
            border border-white/30 rounded-xl
            shadow-2xl shadow-black/50 overflow-hidden
            animate-slideDown
          `}
          role="listbox"
        >
          <div className="max-h-60 overflow-y-auto custom-scrollbar py-2">
            {options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`
                  w-full px-4 py-3 text-left
                  flex items-center
                  transition-all duration-150
                  ${value === option.value
                    ? 'bg-rpg-accent/30 text-white'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }
                  ${highlightedIndex === index ? 'bg-white/10' : ''}
                `}
                role="option"
                aria-selected={value === option.value}
              >
                {renderOptionContent(option)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// アニメーションのためのスタイル
const style = `
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slideDown {
    animation: slideDown 0.2s ease-out;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

// スタイルをヘッドに追加
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = style;
  document.head.appendChild(styleElement);
}