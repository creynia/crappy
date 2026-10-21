import { isBetTypeId, Simulator } from '../../sim';
import type { SceneConfig } from '../../sim';
import { RULE_PRESETS } from '../../sim';
import type { RulePresetId } from '../../sim';
import { Link } from '../components/Link';
import { useStore } from '../context';
import { simSettings } from '../simSettings';

export function Play({ query }: { query: URLSearchParams }) {
  const store = useStore();
  const s = store.settings;
  const preset = query.get('preset');
  const rules = query.get('rules');
  const rulesPreset: RulePresetId | undefined =
    rules && Object.prototype.hasOwnProperty.call(RULE_PRESETS, rules)
      ? (rules as RulePresetId)
      : undefined;
  const scene: SceneConfig = {
    id: 'sandbox',
    version: 1,
    bankroll: Math.round(s.defaultBankroll * 100),
    allowedBets: 'all',
    ...(isBetTypeId(preset) ? { highlightedBets: [preset] } : {}),
    ui: { showSettings: true, showBankroll: true, showHistory: true, hints: true },
  };
  return (
    <div class="page page-wide">
      <h1 class="sr">Practice table</h1>
      <p class="play-challenge-link">
        <Link to="/challenge" class="btn btn-ghost">
          Challenge: 300 scored rolls
        </Link>
      </p>
      <Simulator
        key={`${scene.bankroll}:${preset ?? ''}:${rulesPreset ?? ''}`}
        scene={scene}
        mode="sandbox"
        persistKey="crappy:sandbox"
        initialSettings={{ ...simSettings(s), ...(rulesPreset ? { rulesPreset } : {}) }}
      />
    </div>
  );
}
