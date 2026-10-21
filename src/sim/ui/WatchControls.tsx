import { useEffect, useRef } from 'preact/hooks';
import type { WatchSpeed, WatchState } from './useWatchReplay';
import { fmtMoney } from './text';

export interface WatchControlsProps {
  watch: WatchState;
  busy: boolean;
  onToggle: () => void;
  onStep: () => void;
  onScrub: (index: number) => void;
  onSpeed: (speed: WatchSpeed) => void;
  onExit: () => void;
}

const SPEEDS: WatchSpeed[] = [1, 4, 16];

/** Play/pause, speed, step, scrub and exit for a replayed auto-roll run. */
export function WatchControls(p: WatchControlsProps) {
  const { watch } = p;
  const root = useRef<HTMLElement>(null);
  // bring the controls into view when the replay starts (the page was scrolled to the auto-roll panel)
  useEffect(() => root.current?.scrollIntoView?.({ block: 'nearest' }), []);
  const total = watch.log.length;
  const finished = watch.index >= total;
  return (
    <section class="sim-watch" ref={root} aria-label="Replay controls" data-testid="watch-controls">
      <p class="sim-watch-status">
        Watching a replay: roll {watch.index} of {total}
        {finished ? `. Finished at ${fmtMoney(watch.finalEquity)}.` : ''}
      </p>
      <label class="sim-watch-scrub">
        <span class="sim-sr">Scrub the replay</span>
        <input
          type="range"
          min={0}
          max={total}
          value={watch.index}
          aria-valuetext={`Roll ${watch.index} of ${total}`}
          onInput={(e) => p.onScrub(Number(e.currentTarget.value))}
        />
      </label>
      <div class="sim-watch-row">
        <button type="button" class="sim-ar-btn" onClick={p.onToggle} data-testid="watch-toggle">
          {watch.playing ? 'Pause' : finished ? 'Replay' : 'Play'}
        </button>
        <button
          type="button"
          class="sim-ar-btn"
          disabled={p.busy || finished}
          onClick={p.onStep}
          data-testid="watch-step"
        >
          Step
        </button>
        <span class="sim-watch-speeds" role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              class="sim-ar-btn"
              aria-pressed={watch.speed === s}
              onClick={() => p.onSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </span>
        <button type="button" class="sim-ar-btn" onClick={p.onExit} data-testid="watch-exit">
          Exit
        </button>
      </div>
    </section>
  );
}
