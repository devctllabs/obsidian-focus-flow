import { PlusIcon, SettingsIcon } from '../ui/Icons';
import type { FocusFlowMode } from './FocusFlowShell';

const PRIMARY: Array<{ mode: FocusFlowMode; label: string; description: string }> = [
  { mode: 'focus', label: 'Focus', description: 'Choose what to do now' },
  { mode: 'plan', label: 'Plan', description: 'Shape the next commitment' },
  { mode: 'inbox', label: 'Inbox', description: 'Decide what belongs' },
  { mode: 'history', label: 'History', description: 'Learn from what happened' },
];

export function PageMenu({
  mode,
  inboxCount,
  onModeChange,
  onCapture,
}: {
  mode: FocusFlowMode;
  inboxCount: number;
  onModeChange: (mode: FocusFlowMode) => void;
  onCapture?: () => void;
}) {
  return (
    <div className="focus-flow__navigation">
        <nav aria-label="Focus Flow pages" className="focus-flow__page-tabs">
          {PRIMARY.map((page) => (
            <button aria-current={page.mode === mode || (page.mode === 'focus' && mode === 'close') ? 'page' : undefined} key={page.mode} onClick={() => onModeChange(page.mode)} type="button">
              {page.label}
              {page.mode === 'inbox' && inboxCount > 0 && <span className="focus-flow__nav-count">{inboxCount}</span>}
            </button>
          ))}
        </nav>
        <div className="focus-flow__navigation-tools">
          {onCapture && <button aria-label="Capture Candidate" className="focus-flow__icon-button" onClick={onCapture} title="Capture Candidate" type="button"><PlusIcon /></button>}
          <button aria-label="Settings" title="Settings" aria-current={mode === 'settings' ? 'page' : undefined} className="focus-flow__icon-button" onClick={() => onModeChange('settings')} type="button"><SettingsIcon /></button>
        </div>
    </div>
  );
}
