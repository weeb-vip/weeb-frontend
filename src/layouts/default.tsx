import {ScrollRestoration} from "react-router-dom";
import React from "react";

interface PropsWithChildren<T = {}> {
  children: React.ReactNode;
}


function DefaultLayout({ children }: PropsWithChildren<{}>) {
  return (
    <div className={"w-full py-8 px-4 lg:px-16"}>
      {children}
    </div>
  );
}

export { DefaultLayout as default };

