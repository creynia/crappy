import { useEffect } from 'preact/hooks';
import { Shell } from './components/Shell';
import { useStore } from './context';
import { consumeFreshNav, useRoute } from './router';
import { renderRoute } from './routes';
import { applyTheme } from './theme';

const SCROLL_KEY = 'crappy:scroll';

function readScroll(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}
function writeScroll(hash: string, y: number) {
  try {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ ...readScroll(), [hash]: y }));
  } catch {
    /* ignore */
  }
}

export function App() {
  const route = useRoute();
  const store = useStore();
  const { theme, animationSpeed, reduceMotion } = store.settings;
  useEffect(() => applyTheme(store.settings), [theme, animationSpeed, reduceMotion]);

  // Remember scroll per hash; top on new navigation, restore on back/forward into a lesson.
  useEffect(() => {
    const hash = route.hash;
    const fresh = consumeFreshNav();
    const saved = readScroll()[hash];
    const y = !fresh && route.path.startsWith('/learn/') && saved ? saved : 0;
    if (route.query.get('term') === null) window.scrollTo?.(0, y);
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => writeScroll(hash, window.scrollY));
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('scroll', on);
      cancelAnimationFrame(raf);
    };
  }, [route.hash]);

  return <Shell path={route.path}>{renderRoute(route)}</Shell>;
}
