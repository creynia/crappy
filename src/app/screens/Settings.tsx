import { useState } from 'preact/hooks';
import { useStore } from '../context';
import { decodeImport } from '../storage';
import { effectiveSpeed } from '../theme';
import type { SpeedSetting, ThemeSetting } from '../storage';

export function Settings() {
  const store = useStore();
  const s = store.settings;
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const forcedInstant = effectiveSpeed(s) === 'instant' && s.animationSpeed !== 'instant';
  return (
    <div class="page">
      <h1>Settings</h1>
      <section class="card form">
        <label>
          Theme
          <select
            value={s.theme}
            onChange={(e) => store.updateSettings({ theme: e.currentTarget.value as ThemeSetting })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>
          Animation speed
          <select
            value={forcedInstant ? 'instant' : s.animationSpeed}
            disabled={forcedInstant}
            onChange={(e) =>
              store.updateSettings({ animationSpeed: e.currentTarget.value as SpeedSetting })
            }
          >
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
            <option value="instant">
              {forcedInstant ? 'Instant (reduced motion)' : 'Instant'}
            </option>
          </select>
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={s.reduceMotion}
            onChange={(e) => store.updateSettings({ reduceMotion: e.currentTarget.checked })}
          />
          Reduce motion (always instant; your device setting is honoured too)
        </label>
        <label>
          Default bankroll ($)
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={50}
            value={s.defaultBankroll}
            onChange={(e) => {
              const v = Number(e.currentTarget.value);
              if (Number.isFinite(v) && v >= 1)
                store.updateSettings({ defaultBankroll: Math.round(v) });
            }}
          />
        </label>
        <label>
          Rolls per hour
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={10}
            value={s.rollsPerHour}
            onChange={(e) => {
              const v = Number(e.currentTarget.value);
              if (Number.isFinite(v) && v >= 1)
                store.updateSettings({ rollsPerHour: Math.round(v) });
            }}
          />
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={s.confirmSuckerBets}
            onChange={(e) => store.updateSettings({ confirmSuckerBets: e.currentTarget.checked })}
          />
          Confirm sucker bets (ask twice before placing a red-tier bet)
        </label>
      </section>

      <section class="card form">
        <h2>Your progress</h2>
        <div class="row">
          <button
            type="button"
            class="btn"
            onClick={() => {
              setCode(store.exportCode());
              setMsg('Copy this code somewhere safe. Paste it on another device to restore.');
            }}
          >
            Export
          </button>
          <button
            type="button"
            class="btn btn-ghost"
            disabled={code.trim() === '' || confirmImport}
            onClick={() => {
              if (decodeImport(code)) {
                setMsg('');
                setConfirmImport(true);
              } else setMsg('That code is not valid.');
            }}
          >
            Import
          </button>
        </div>
        <textarea
          rows={3}
          readOnly={confirmImport}
          aria-label="Progress code"
          placeholder="Progress code"
          value={code}
          onInput={(e) => setCode(e.currentTarget.value)}
        />
        {confirmImport && (
          <div class="row">
            <span>Replace your current progress?</span>
            <button
              type="button"
              class="btn btn-danger"
              onClick={() => {
                setMsg(store.importCode(code) ? 'Progress imported.' : 'That code is not valid.');
                setConfirmImport(false);
              }}
            >
              Yes, replace
            </button>
            <button type="button" class="btn btn-ghost" onClick={() => setConfirmImport(false)}>
              Cancel
            </button>
          </div>
        )}
        {msg && <p role="status">{msg}</p>}
        {confirmReset ? (
          <div class="row">
            <span>Erase all lesson progress?</span>
            <button
              type="button"
              class="btn btn-danger"
              onClick={() => {
                store.reset();
                setConfirmReset(false);
                setMsg('Progress reset.');
              }}
            >
              Yes, reset
            </button>
            <button type="button" class="btn btn-ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" class="btn btn-danger" onClick={() => setConfirmReset(true)}>
            Reset progress
          </button>
        )}
      </section>

      <section class="muted about">
        <h2>About</h2>
        <p>
          crappy v{__APP_VERSION__}. MIT licensed. Practice only; no real money, ever. Please gamble
          responsibly.
        </p>
      </section>
    </div>
  );
}
