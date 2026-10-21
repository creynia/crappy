import { useRef, useState } from 'preact/hooks';
import type { Bet, Cents, Dice as DicePair, GameEvent, GameState } from '../engine/types';
import { buildAnimationQueue, playTimeline, type Player, type Speed } from './animation';
import { describeRoll, rollTone } from './text';
import type { ToastItem } from './Toasts';

/** Plays a roll's timeline: the shown (pre/post) state, tumbling dice, and lost/won chip overlays. */
export function useAnimationPlayer(
  getSpeed: () => Speed,
  pushToast: (text: string, tone?: ToastItem['tone']) => void,
) {
  const [shown, setShown] = useState<GameState | null>(null);
  const [rolling, setRolling] = useState<{ dice: DicePair; durationMs: number } | null>(null);
  const [lost, setLost] = useState<Bet[]>([]);
  const [won, setWon] = useState<{ bet: Bet; payout: Cents }[]>([]);
  const [busy, setBusy] = useState(false);
  const player = useRef<Player | null>(null);

  const run = (pre: GameState, post: GameState, events: GameEvent[]) => {
    const roll = events.find(
      (e): e is Extract<GameEvent, { type: 'dice-rolled' }> => e.type === 'dice-rolled',
    );
    const text = describeRoll(events);
    const tone = rollTone(events);
    const speed = getSpeed();
    player.current?.cancel();
    const tl = buildAnimationQueue(events, speed);
    const finish = () => {
      setShown(null);
      setRolling(null);
      setLost([]);
      setWon([]);
      setBusy(false);
      player.current = null;
      pushToast(text, tone);
    };
    if (!tl.steps.length || !roll) {
      finish();
      return;
    }
    setBusy(true);
    setShown(pre);
    player.current = playTimeline(tl, {
      onStart: (s) => {
        if (s.kind === 'dice') setRolling({ dice: roll.roll.dice, durationMs: s.duration });
        if (s.kind === 'lose') {
          const ids = new Set(s.events.map((e) => (e.type === 'bet-lost' ? e.betId : '')));
          setShown(post);
          setLost(pre.bets.filter((b) => ids.has(b.id)));
        }
        if (s.kind === 'win') {
          setShown(post);
          const w: { bet: Bet; payout: Cents }[] = [];
          for (const e of s.events)
            if (e.type === 'bet-won') {
              const bet = pre.bets.find((b) => b.id === e.betId);
              if (bet) w.push({ bet, payout: e.profit - e.vig + (e.staysUp ? 0 : e.amount) });
            }
          setWon(w);
        }
      },
      onEnd: (s) => {
        if (s.kind === 'dice') {
          setRolling(null);
          setShown(post);
        }
        if (s.kind === 'lose') setLost([]);
        if (s.kind === 'win') setWon([]);
      },
      onDone: finish,
    });
  };

  /** Cancels any running timeline and clears every animation overlay (used by reset). */
  const clear = () => {
    player.current?.cancel();
    setShown(null);
    setBusy(false);
    setRolling(null);
    setLost([]);
    setWon([]);
  };

  return {
    shown,
    rolling,
    lost,
    won,
    busy,
    run,
    clear,
    skip: () => player.current?.skip(),
    cancel: () => player.current?.cancel(),
    playing: () => !!player.current && !player.current.done,
  };
}
