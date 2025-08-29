import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-8">
      <div className="max-w-screen-2xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Left side - Brand/Links */}
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              © 2024 WeebVIP
            </div>
            <div className="flex space-x-4 text-sm text-gray-500 dark:text-gray-500">
              <a href="#" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                About
              </a>
              <a href="#" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                Terms
              </a>
            </div>
          </div>
          
          {/* Right side - Version */}
          <div className="text-xs text-gray-400 dark:text-gray-500">
            Version {__APP_VERSION__}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;