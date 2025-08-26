import React from "react";

interface FullWidthLayoutProps {
  children: React.ReactNode;
}

function FullWidthLayout({ children }: FullWidthLayoutProps) {
  return (
    <div className={"w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-300"}>
      {children}
    </div>
  );
}

export { FullWidthLayout as default };
