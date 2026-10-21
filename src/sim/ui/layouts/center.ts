import type { BetTypeId } from '../../engine/types';
import type { Rect, RegionDef, RegionId, TableLayout } from './types';

function r(id: RegionId, rect: Rect, label: string, sublabel: string, bet: BetTypeId): RegionDef {
  // Chips sit to the right of the printed title so the cell stays readable with a bet on it.
  const bonus = id === 'fire' || id === 'all' || id === 'tall' || id === 'small';
  const fx =
    rect.w > 700 ? 0.88 : id.startsWith('hard') || bonus ? 0.86 : rect.w < 250 ? 0.76 : 0.82;
  const fy = rect.w < 250 ? 0.6 : bonus ? 0.42 : 0.5;
  return {
    id,
    rect,
    label,
    sublabel,
    betTypes: [bet],
    chipSpots: { main: { x: rect.x + rect.w * fx, y: rect.y + rect.h * fy } },
  };
}

// simulator.md section 3.4, with heights raised so every cell is >= 102 units (44 CSS px at 390px wide).
const regions: RegionDef[] = [
  r('any-7', { x: 20, y: 20, w: 860, h: 110 }, 'Any Seven', 'Pays 4 to 1', 'any-7'),
  r('hard-6', { x: 20, y: 145, w: 425, h: 120 }, 'Hard 6', 'Pays 9 to 1', 'hard-6'),
  r('hard-10', { x: 455, y: 145, w: 425, h: 120 }, 'Hard 10', 'Pays 7 to 1', 'hard-10'),
  r('hard-8', { x: 20, y: 275, w: 425, h: 120 }, 'Hard 8', 'Pays 9 to 1', 'hard-8'),
  r('hard-4', { x: 455, y: 275, w: 425, h: 120 }, 'Hard 4', 'Pays 7 to 1', 'hard-4'),
  r('aces-2', { x: 20, y: 410, w: 205, h: 120 }, 'Aces', 'Pays 30 to 1', 'aces-2'),
  r('ace-deuce-3', { x: 235, y: 410, w: 205, h: 120 }, 'Ace-Deuce', 'Pays 15 to 1', 'ace-deuce-3'),
  r('yo-11', { x: 450, y: 410, w: 205, h: 120 }, 'Yo', 'Pays 15 to 1', 'yo-11'),
  r('boxcars-12', { x: 665, y: 410, w: 205, h: 120 }, 'Boxcars', 'Pays 30 to 1', 'boxcars-12'),
  r('any-craps', { x: 20, y: 545, w: 860, h: 105 }, 'Any Craps', 'Pays 7 to 1', 'any-craps'),
  r('horn', { x: 20, y: 660, w: 280, h: 105 }, 'Horn', '2, 3, 11, 12', 'horn'),
  r('c-e', { x: 310, y: 660, w: 280, h: 105 }, 'C and E', 'Craps and eleven', 'c-e'),
  r('world', { x: 600, y: 660, w: 280, h: 105 }, 'World', 'Horn plus any 7', 'world'),
  // Bonus side-bet rail (I037): multi-hand bets with progress pips; placed before a new shooter.
  r(
    'fire',
    { x: 20, y: 790, w: 425, h: 120 },
    'Fire Bet',
    '4, 5, 6 points: 24, 249, 999 to 1',
    'fire',
  ),
  r('all', { x: 455, y: 790, w: 425, h: 120 }, 'All', '2 to 12 before a 7: 175 to 1', 'all'),
  r('small', { x: 20, y: 920, w: 425, h: 120 }, 'Small', '2 to 6 before a 7: 34 to 1', 'small'),
  r('tall', { x: 455, y: 920, w: 425, h: 120 }, 'Tall', '8 to 12 before a 7: 34 to 1', 'tall'),
];

const zero = { x: 0, y: 0 };
export const centerLayout: TableLayout = {
  id: 'center',
  viewBox: { w: 900, h: 1060 },
  regions,
  puck: { 4: zero, 5: zero, 6: zero, 8: zero, 9: zero, 10: zero, off: zero },
  puckRadius: 0,
  chipRadius: 32,
  minTapUnits: 102,
};
