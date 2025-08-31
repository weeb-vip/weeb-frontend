import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

export interface FormInputProps {
  id: string;
  name: string;
  type: 'text' | 'email' | 'password';
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  label?: string;
  icon?: IconDefinition;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showPasswordToggle?: boolean;
  onPasswordToggle?: () => void;
  isPasswordVisible?: boolean;
}

const FormInput: React.FC<FormInputProps> = ({
  id,
  name,
  type,
  value,
  onChange,
  placeholder,
  label,
  icon,
  error,
  required = false,
  disabled = false,
  className = '',
  showPasswordToggle = false,
  onPasswordToggle,
  isPasswordVisible = false
}) => {
  // Base classes for all inputs
  const baseInputClasses = `
    w-full px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-300
    bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `;

  // Error and normal state classes
  const stateClasses = error 
    ? 'border-red-500 focus:ring-red-400' 
    : 'border-gray-300 dark:border-gray-600 focus:border-blue-400 dark:focus:border-blue-500';

  // Label classes - show label if provided, otherwise use sr-only
  const labelClasses = label
    ? 'block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300'
    : 'sr-only';

  // Icon positioning
  const hasIcon = icon || showPasswordToggle;
  const iconPaddingClass = icon ? 'pl-10' : 'pl-4';
  const passwordTogglePaddingClass = showPasswordToggle ? 'pr-10' : 'pr-4';

  const inputClasses = `
    ${baseInputClasses}
    ${stateClasses}
    ${iconPaddingClass}
    ${passwordTogglePaddingClass}
    ${className}
  `.trim();

  return (
    <div>
      {label && (
        <label 
          htmlFor={id} 
          className={labelClasses}
        >
          {label}
        </label>
      )}
      
      <div className="relative">
        {/* Left icon */}
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FontAwesomeIcon icon={icon} className="h-5 w-5 text-gray-400" />
          </div>
        )}

        {/* Input field */}
        <input
          id={id}
          name={name}
          type={showPasswordToggle && isPasswordVisible ? 'text' : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={inputClasses}
          aria-describedby={error ? `${id}-error` : undefined}
        />

        {/* Password toggle button */}
        {showPasswordToggle && onPasswordToggle && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={onPasswordToggle}
            tabIndex={-1}
          >
            <FontAwesomeIcon 
              icon={isPasswordVisible ? faEyeSlash : faEye} 
              className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" 
            />
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};

export default FormInput;