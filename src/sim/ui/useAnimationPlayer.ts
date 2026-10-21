import { useRef, useState } from 'preact/hooks';
import type { Bet, Cents, Dice as DicePair, GameEvent, GameState } from '../engine/types';
import { buildAnimationQueue, playTimeline, type Player, type Speed } from './animation';
import { describeRoll, rollAnnouncement, rollTone } from './text';
import type { ToastItem } from './Toasts';

/** Plays a roll's timeline: the shown (pre/post) state, tumbling dice, and lost/won chip overlays. */
export function useAnimationPlayer(
  getSpeed: () => Speed,
  pushToast: (text: string, tone?: ToastItem['tone']) => void,
  announce: (text: string) => void,
) {
  const [shown, setShown] = useState<GameState | null>(null);
  const [rolling, setRolling] = useState<{ dice: DicePair; durationMs: number } | null>(null);
  const [lost, setLost] = useState<Bet[]>([]);
  const [won, setWon] = useState<{ bet: Bet; payout: Cents }[]>([]);
  const [travelling, setTravelling] = useState<Bet[]>([]);
  const [chipMs, setChipMs] = useState<number | undefined>(undefined);
  /** the chip step currently animating; overlays are static outside their own step */
  const [phase, setPhase] = useState<'travel' | 'lose' | 'win' | null>(null);
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
      setTravelling([]);
      setChipMs(undefined);
      setPhase(null);
      setBusy(false);
      player.current = null;
      pushToast(text, tone);
      // the one live message per roll (the toast above is visual only)
      announce(rollAnnouncement(events, post));
    };
    if (!tl.steps.length || !roll) {
      finish();
      return;
    }
    // Every overlay is computed up front and shown as soon as the dice settle, so a chip that is
    // about to move, be swept or be paid stays where it was until its own step animates it.
    const travelIds = new Set(events.map((e) => (e.type === 'bet-travelled' ? e.betId : '')));
    const lostIds = new Set(events.map((e) => (e.type === 'bet-lost' ? e.betId : '')));
    const travelBets = post.bets.filter((b) => travelIds.has(b.id));
    const lostBets = pre.bets.filter((b) => lostIds.has(b.id));
    const wonBets: { bet: Bet; payout: Cents }[] = [];
    for (const e of events)
      if (e.type === 'bet-won') {
        const bet = pre.bets.find((b) => b.id === e.betId);
        if (bet) wonBets.push({ bet, payout: e.profit - e.vig + (e.staysUp ? 0 : e.amount) });
      }
    setBusy(true);
    setShown(pre);
    setPhase(null);
    player.current = playTimeline(tl, {
      onStart: (s) => {
        if (s.kind === 'dice') setRolling({ dice: roll.roll.dice, durationMs: s.duration });
        if (s.kind === 'travel' || s.kind === 'lose' || s.kind === 'win') {
          setChipMs(s.duration);
          setPhase(s.kind);
        }
      },
      onEnd: (s) => {
        if (s.kind === 'dice') {
          setRolling(null);
          setShown(post);
          setTravelling(travelBets);
          setLost(lostBets);
          setWon(wonBets);
        }
        if (s.kind === 'travel') setTravelling([]);
        if (s.kind === 'lose') setLost([]);
        if (s.kind === 'win') setWon([]);
        if (s.kind === 'travel' || s.kind === 'lose' || s.kind === 'win') setPhase(null);
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
    setTravelling([]);
    setChipMs(undefined);
    setPhase(null);
  };

  return {
    shown,
    rolling,
    lost,
    won,
    travelling,
    chipMs,
    chipPhase: phase,
    busy,
    run,
    clear,
    skip: () => player.current?.skip(),
    cancel: () => player.current?.cancel(),
    playing: () => !!player.current && !player.current.done,
  };
}
