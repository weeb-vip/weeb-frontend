/// <reference types="vite/client" />

// Add support for ?worker imports
declare module '*?worker' {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}

declare module '*?worker&url' {
  const url: string;
  export default url;
}