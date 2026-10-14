/// <reference types="vite/client" />

declare const __SINGLE_FILE__: boolean;
declare const __APP_VERSION__: string;

declare module 'virtual:content' {
  const bundle: import('./content/types').ContentBundle;
  export default bundle;
}
