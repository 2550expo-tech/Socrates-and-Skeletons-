// react-dom has no type package in this app (it is only used here, to write the icon SVGs).
declare module 'react-dom/server' {
  import type { ReactNode } from 'react';
  export function renderToStaticMarkup(element: ReactNode): string;
}
