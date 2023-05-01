import React from "react";

interface FullWidthLayoutProps {
  children: React.ReactNode;
}

function FullWidthLayout({ children }: FullWidthLayoutProps) {
  return (
    <div className={"w-full"}>
      {children}
    </div>
  );
}

export { FullWidthLayout as default };
