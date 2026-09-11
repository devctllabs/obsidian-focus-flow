import { useState, useSyncExternalStore } from 'react';
import {
  CLASSIC_INDIGO,
  isHexColor,
  type AccentPreference,
  type AppearanceController,
} from '../appearance/appearance';
import { CheckIcon, ChevronIcon } from '../ui/Icons';
import { formatErrorMessage } from '../ui/error-message';

const ACCENT_SWATCHES = [
  ['Indigo', CLASSIC_INDIGO.light, 'indigo'],
  ['Blue', '#2563EB', 'custom'],
  ['Teal', '#0F766E', 'custom'],
  ['Green', '#4D7C0F', 'custom'],
  ['Amber', '#B45309', 'custom'],
  ['Rose', '#BE185D', 'custom'],
] as const;

export function AccentSetting({ appearance }: { appearance: AppearanceController }) {
  const current = useSyncExternalStore(
    appearance.subscribe,
    appearance.getSnapshot,
    appearance.getSnapshot,
  );
  const [expanded, setExpanded] = useState(false);
  const [hex, setHex] = useState(() => current.source === 'custom' ? current.seed : '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState('');

  const save = async (preference: AccentPreference) => {
    setPending(true);
    setError(null);
    setSaved('');
    try {
      await appearance.commit(preference);
      setHex(preference.source === 'custom' ? preference.seed : '');
      setSaved('Accent color saved');
    } catch (cause) {
      setError(formatErrorMessage(cause, 'Could not save the accent color.'));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="focus-flow__appearance-settings" aria-label="Appearance">
      <h2>
        <button
          aria-controls="focus-flow-accent-editor"
          aria-expanded={expanded}
          aria-label="Accent color"
          className="focus-flow__settings-disclosure"
          disabled={pending}
          onClick={() => setExpanded(!expanded)}
          type="button"
        >
          <span className="focus-flow__settings-disclosure-copy">
            <span>Accent color</span>
            <small>{accentDescription(current)}</small>
          </span>
          <span className="focus-flow__settings-disclosure-value">
            <span aria-hidden="true" className="focus-flow__accent-marker" />
            <span>{accentLabel(current)}</span>
          </span>
          <ChevronIcon direction={expanded ? 'down' : 'right'} />
        </button>
      </h2>
      <div id="focus-flow-accent-editor" hidden={!expanded}>
        {expanded && <AccentEditor current={current} error={error} hex={hex} pending={pending} saved={saved} onHexChange={setHex} onSave={(preference) => void save(preference)} />}
      </div>
    </section>
  );
}

function AccentEditor({ current, error, hex, pending, saved, onHexChange, onSave }: {
  current: AccentPreference;
  error: string | null;
  hex: string;
  pending: boolean;
  saved: string;
  onHexChange: (value: string) => void;
  onSave: (preference: AccentPreference) => void;
}) {
  return <div className="focus-flow__accent-editor">
    <div aria-label="Accent color" className="focus-flow__color-swatches" role="group">
      <button aria-pressed={current.source === 'obsidian'} disabled={pending} onClick={() => onSave({ source: 'obsidian' })} type="button">Obsidian</button>
      {ACCENT_SWATCHES.map(([name, color, source]) => {
        const active = source === 'indigo' ? current.source === 'indigo' : current.source === 'custom' && current.seed === color;
        const preference: AccentPreference = source === 'indigo' ? { source: 'indigo' } : { source: 'custom', seed: color };
        return <button aria-label={name} aria-pressed={active} className="focus-flow__color-swatch" disabled={pending} key={color} onClick={() => onSave(preference)} title={name} type="button">
          <span aria-hidden="true" style={{ backgroundColor: color }} />
          {active && <CheckIcon />}
        </button>;
      })}
    </div>
    <form className="focus-flow__custom-color" onSubmit={(event) => { event.preventDefault(); if (isHexColor(hex)) onSave({ source: 'custom', seed: hex }); }}>
      <label>Custom HEX<input aria-invalid={hex.length > 0 && !isHexColor(hex)} aria-label="Custom accent HEX" autoComplete="off" disabled={pending} maxLength={7} onChange={(event) => onHexChange(event.currentTarget.value.toUpperCase())} placeholder="#5B5BD6" spellCheck={false} value={hex} /></label>
      <button disabled={pending || !isHexColor(hex)} type="submit">{pending ? 'Saving…' : 'Save color'}</button>
    </form>
    {error && <p className="focus-flow__error" role="alert">{error}</p>}
    <p className="focus-flow__sr-only" role="status">{saved}</p>
  </div>;
}

function accentLabel(preference: AccentPreference): string {
  if (preference.source === 'obsidian') return 'Obsidian';
  if (preference.source === 'indigo') return 'Indigo';
  return preference.seed;
}

function accentDescription(preference: AccentPreference): string {
  if (preference.source === 'obsidian') return 'Uses your Obsidian Appearance accent';
  if (preference.source === 'indigo') return 'Original Focus Flow colors';
  return 'Custom color adapted for light and dark themes';
}
