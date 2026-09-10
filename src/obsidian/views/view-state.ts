import type { FocusFlowMode } from '../../features/shell/FocusFlowShell';

export type InboxSection = 'candidates' | 'distractions';

export interface FocusFlowViewState {
  mode: FocusFlowMode;
  inboxSection: InboxSection;
}

export function normalizeViewState(state: unknown): FocusFlowViewState {
  if (!isViewStateRecord(state)) return { mode: 'focus', inboxSection: 'candidates' };
  if (state.mode === 'distractions') return { mode: 'inbox', inboxSection: 'distractions' };
  if (isFocusFlowMode(state.mode)) return { mode: state.mode, inboxSection: inboxSectionOf(state) };
  return { mode: 'focus', inboxSection: 'candidates' };
}

function isViewStateRecord(state: unknown): state is Record<string, unknown> {
  return typeof state === 'object' && state !== null && 'mode' in state;
}

function isFocusFlowMode(mode: unknown): mode is FocusFlowMode {
  return typeof mode === 'string' && ['focus', 'plan', 'inbox', 'history', 'settings', 'close'].includes(mode);
}

function inboxSectionOf(state: Record<string, unknown>): InboxSection {
  return state.inboxSection === 'distractions' ? 'distractions' : 'candidates';
}

export function normalizeViewMode(state: unknown): FocusFlowMode {
  return normalizeViewState(state).mode;
}
