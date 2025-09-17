import React from "react";

interface PropsWithChildren<T = {}> {
  children: React.ReactNode;
}


function DefaultLayout({ children }: PropsWithChildren<{}>) {
  return (
    <div className={"w-full py-8 px-4 lg:px-16 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-300"}>
      {children}
    </div>
  );
}

export { DefaultLayout as default };

