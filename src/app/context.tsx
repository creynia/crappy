import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext, useEffect, useReducer } from 'preact/hooks';
import type { ContentBundle } from '../content/types';
import { Store } from './store';

const ContentCtx = createContext<ContentBundle | null>(null);
const StoreCtx = createContext<Store | null>(null);

export function AppProviders(props: {
  content: ContentBundle;
  store: Store;
  children: ComponentChildren;
}) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const bump = () => tick(0);
  useEffect(() => {
    const off = props.store.subscribe(bump);
    const flush = () => props.store.flush();
    window.addEventListener('pagehide', flush);
    return () => {
      off();
      window.removeEventListener('pagehide', flush);
    };
  }, [props.store]);
  return (
    <ContentCtx.Provider value={props.content}>
      <StoreCtx.Provider value={props.store}>{props.children}</StoreCtx.Provider>
    </ContentCtx.Provider>
  );
}

export function useContent(): ContentBundle {
  const c = useContext(ContentCtx);
  if (!c) throw new Error('useContent outside AppProviders');
  return c;
}

/** The store; the provider re-renders the tree on every change, so reads are always fresh. */
export function useStore(): Store {
  const s = useContext(StoreCtx);
  if (!s) throw new Error('useStore outside AppProviders');
  return s;
}
