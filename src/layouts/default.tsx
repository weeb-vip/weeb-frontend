interface PropsWithChildren<T = {}> {
  children: React.ReactNode;
}


function DefaultLayout({ children }: PropsWithChildren<{}>) {
  return (
    <div className={"w-full py-8 px-16"}>
      {children}
    </div>
  );
}

export { DefaultLayout as default };

