import { useEffect, useState } from 'preact/hooks';
import type { SceneConfig } from '../scene/types';

function matchLandscape(scene: SceneConfig): boolean {
  const o = scene.ui?.orientation;
  if (o === 'landscape') return true;
  if (o === 'portrait') return false;
  try {
    return typeof matchMedia === 'function' && matchMedia('(orientation: landscape)').matches;
  } catch {
    return false;
  }
}

/** Landscape layout flag: pinned by `ui.orientation`, otherwise follows the device orientation. */
export function useLandscape(scene: SceneConfig): boolean {
  const [landscape, setLandscape] = useState(() => matchLandscape(scene));
  const orientation = scene.ui?.orientation;
  useEffect(() => {
    const pinned = orientation && orientation !== 'auto';
    setLandscape(matchLandscape(scene));
    if (pinned || typeof matchMedia !== 'function') return;
    const mq = matchMedia('(orientation: landscape)');
    const on = () => setLandscape(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [orientation]);
  return landscape;
}
