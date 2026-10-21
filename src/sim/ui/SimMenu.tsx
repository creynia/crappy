import type { RulePresetId } from '../engine/types';
import type { ResolvedSimSettings } from './settings';

export interface SimMenuProps {
  canRebet: boolean;
  busy: boolean;
  onRebet: () => void;
  onReset: (opts?: { rules?: RulePresetId }) => void;
  rulesValue: RulePresetId;
  settings: ResolvedSimSettings;
  setSettings: (s: ResolvedSimSettings) => void;
  /** sandbox only: share the table as a link / copy it as a lesson scene */
  onShare?: () => void;
  onCopyScene?: () => void;
}

/** The sandbox table menu: rebet, reset, rules preset, speed and skip-preview. */
export function SimMenu({
  canRebet,
  busy,
  onRebet,
  onReset,
  rulesValue,
  settings,
  setSettings,
  onShare,
  onCopyScene,
}: SimMenuProps) {
  return (
    <section class="sim-menu" aria-label="Table menu">
      <div class="sim-menu-row">
        <button type="button" onClick={onRebet} disabled={!canRebet || busy}>
          Rebet
        </button>
        <button type="button" onClick={() => onReset()}>
          Reset bankroll
        </button>
      </div>
      {onShare || onCopyScene ? (
        <div class="sim-menu-row">
          {onShare ? (
            <button type="button" onClick={onShare}>
              Share table
            </button>
          ) : null}
          {onCopyScene ? (
            <button type="button" onClick={onCopyScene}>
              Copy as scene YAML
            </button>
          ) : null}
        </div>
      ) : null}
      <label class="sim-menu-field">
        Rules
        <select
          value={rulesValue}
          onChange={(e) => onReset({ rules: e.currentTarget.value as RulePresetId })}
        >
          <option value="standard-vegas">Standard Vegas (3-4-5x)</option>
          <option value="field-3x-12">Field pays 3x on 12</option>
          <option value="odds-10x">10x odds</option>
          <option value="odds-100x">100x odds</option>
        </select>
      </label>
      <label class="sim-menu-field">
        Speed
        <select
          value={settings.speed}
          onChange={(e) =>
            setSettings({
              ...settings,
              speed: e.currentTarget.value as ResolvedSimSettings['speed'],
            })
          }
        >
          <option value="normal">Normal</option>
          <option value="fast">Fast</option>
          <option value="instant">Instant</option>
        </select>
      </label>
      <label class="sim-menu-check">
        <input
          type="checkbox"
          checked={settings.skipPreview}
          onChange={(e) => setSettings({ ...settings, skipPreview: e.currentTarget.checked })}
        />
        Skip EV preview (tap to bet)
      </label>
    </section>
  );
}
