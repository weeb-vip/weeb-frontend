import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { useDarkModeStore } from '../../services/globalstore';

interface DarkModeToggleProps {
  className?: string;
}

function DarkModeToggle({ className = '' }: DarkModeToggleProps) {
  const { isDarkMode, toggleDarkMode } = useDarkModeStore();

  return (
    <button
      onClick={toggleDarkMode}
      className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-300 w-10 h-10 flex items-center justify-center ${className}`}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <FontAwesomeIcon 
        icon={isDarkMode ? faSun : faMoon} 
        className="text-gray-700 dark:text-gray-300 text-lg"
      />
    </button>
  );
}

export default DarkModeToggle;