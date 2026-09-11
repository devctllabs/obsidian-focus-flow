import { useRef, useState } from 'react';
import type { FocusFlowSettings, WipEnforcement } from '../../settings';
import { RootFolderSetting } from './RootFolderSetting';
import { ChevronIcon } from '../ui/Icons';
import { DialogSurface } from '../ui/DialogSurface';
import { VaultPathPicker } from './VaultPathPicker';
import { formatErrorMessage } from '../ui/error-message';
import type { TagCatalogService } from '../../application/tags/tag-catalog';
import { TagCatalogSettings } from './TagCatalogSettings';
import { ArchiveSettings } from './ArchiveSettings';
import type { WorkspaceLifecycle } from '../../application/workspace/workspace-lifecycle';
import type { AppearanceController } from '../appearance/appearance';
import { AccentSetting } from './AccentSetting';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const WIP_LABELS = { sprintScope: 'Sprint scope', tomorrow: 'Tomorrow', today: 'Today', inProgress: 'In progress' } as const;
type LimitKey = keyof typeof WIP_LABELS;

export interface SettingsController {
  appearance?: AppearanceController;
  tagCatalog?: TagCatalogService;
  lifecycle?: WorkspaceLifecycle;
  listTags?(): readonly string[];
  listCurrentTagUsage?(): Readonly<Record<string, number>>;
  getSettings(): FocusFlowSettings;
  updateSettings(update: (settings: FocusFlowSettings) => FocusFlowSettings): Promise<void>;
  requestRootSetup(root: string): Promise<void>;
  selectExistingRoot(root: string): Promise<void>;
  requestRootMove(root: string, confirmedInPicker?: boolean): Promise<void>;
  requestResumeRootMove(): Promise<void>;
  hasPendingRootMove(): boolean;
  listFolders?(): readonly string[];
  listTemplateFiles?(): readonly string[];
}

export function SettingsSurface({ controller }: { controller: SettingsController }) {
  const [settings, setSettings] = useState(() => controller.getSettings());
  const [editingLimit, setEditingLimit] = useState<LimitKey | null>(null);
  const [template, setTemplate] = useState<keyof FocusFlowSettings['templates'] | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const save = async (update: (current: FocusFlowSettings) => FocusFlowSettings) => {
    setPending(true); setMessage(null);
    try {
      await controller.updateSettings(update);
      setSettings(controller.getSettings()); setMessage('Saved');
      return true;
    } catch (error) {
      setMessage(formatErrorMessage(error, 'Could not save this setting.'));
      return false;
    } finally { setPending(false); }
  };
  return <div className="focus-flow__settings-surface">
    <RootFolderSetting controller={controller} onUpdated={() => setSettings(controller.getSettings())} settings={settings} />
    <WeekdaySetting settings={settings} pending={pending} onSave={save} />
    <WipSettings settings={settings} pending={pending} onEdit={(key) => { setMessage(null); setEditingLimit(key); }} />
    <LimitDialog editing={editingLimit} settings={settings} pending={pending} error={message} onClose={() => { if (!pending) setEditingLimit(null); }} onSave={save} onSaved={() => setEditingLimit(null)} />
    <CatalogSetting controller={controller} />
    <TemplateSettings templates={settings.templates} pending={pending} onChoose={(key) => { setMessage(null); setTemplate(key); }} />
    {controller.appearance && <AccentSetting appearance={controller.appearance} />}
    <LifecycleSetting controller={controller} />
    <TemplatePicker template={template} settings={settings} controller={controller} pending={pending} error={message} onClose={() => { if (!pending) setTemplate(null); }} onSave={save} onSaved={() => setTemplate(null)} />
    <SettingsMessage message={message} visible={!editingLimit && !template} />
  </div>;
}

type SaveSettings = (update: (current: FocusFlowSettings) => FocusFlowSettings) => Promise<boolean>;

function WeekdaySetting({ settings, pending, onSave }: { settings: FocusFlowSettings; pending: boolean; onSave: SaveSettings }) {
  return <section className="focus-flow__cadence-setting"><div className="focus-flow__setting-row"><h2>Week starts on</h2><div className="focus-flow__weekday-picker" role="group" aria-label="First weekday">{WEEKDAYS.map((weekday, index) => <button key={weekday} aria-label={weekday} title={weekday} aria-pressed={settings.firstWeekday === index} disabled={pending} onClick={() => void onSave((current) => ({ ...current, firstWeekday: index as FocusFlowSettings['firstWeekday'] }))} type="button">{weekday.slice(0, 3)}</button>)}</div></div></section>;
}

function WipSettings({ settings, pending, onEdit }: { settings: FocusFlowSettings; pending: boolean; onEdit: (key: LimitKey) => void }) {
  return <section className="focus-flow__wip-settings"><h2>Work in progress</h2>{(Object.keys(WIP_LABELS) as LimitKey[]).map((key) => <button className="focus-flow__limit-row" aria-label={`Edit ${WIP_LABELS[key]} limit`} disabled={pending} key={key} type="button" onClick={() => onEdit(key)}><span>{WIP_LABELS[key]}</span><LimitValue policy={settings.wip[key]} /></button>)}</section>;
}

function LimitValue({ policy }: { policy: { mode: WipEnforcement; limit: number } }) {
  const value = policy.mode === 'off' ? 'Off' : policy.limit;
  const detail = policy.mode === 'off' ? 'No limit' : policy.mode === 'soft' ? 'Ask first' : 'Enforced';
  return <span className="focus-flow__limit-value"><strong>{value}</strong><small>{detail}</small><ChevronIcon direction="right" /></span>;
}

function LimitDialog({ editing, settings, pending, error, onClose, onSave, onSaved }: { editing: LimitKey | null; settings: FocusFlowSettings; pending: boolean; error: string | null; onClose: () => void; onSave: SaveSettings; onSaved: () => void }) {
  if (!editing) return null;
  const savePolicy = async (policy: { mode: WipEnforcement; limit: number }) => {
    const saved = await onSave((current) => ({ ...current, wip: { ...current.wip, [editing]: policy } }));
    if (saved) onSaved();
  };
  return <LimitEditor label={WIP_LABELS[editing]} policy={settings.wip[editing]} pending={pending} error={error} onClose={onClose} onSave={savePolicy} />;
}

function CatalogSetting({ controller }: { controller: SettingsController }) {
  if (!controller.tagCatalog) return null;
  return <TagCatalogSettings service={controller.tagCatalog} tags={controller.listTags?.() ?? []} currentTagUsage={controller.listCurrentTagUsage?.() ?? {}} />;
}

function TemplateSettings({ templates, pending, onChoose }: { templates: FocusFlowSettings['templates']; pending: boolean; onChoose: (key: keyof FocusFlowSettings['templates']) => void }) {
  return <details className="focus-flow__advanced-settings"><summary className="focus-flow__settings-disclosure"><span className="focus-flow__settings-disclosure-copy"><span>Templates</span><small>Candidate, Task and Retrospective note bodies</small></span><span className="focus-flow__settings-disclosure-value">{Object.keys(templates).length} files</span><ChevronIcon direction="right" /></summary>{(Object.keys(templates) as Array<keyof FocusFlowSettings['templates']>).map((key) => <button className="focus-flow__template-row" aria-label={`Choose ${key} template`} disabled={pending} key={key} type="button" onClick={() => onChoose(key)}><span>{key[0]?.toUpperCase()}{key.slice(1)}</span><span title={templates[key]}>{templates[key].split('/').at(-1)}<ChevronIcon direction="right" /></span></button>)}</details>;
}

function LifecycleSetting({ controller }: { controller: SettingsController }) { return controller.lifecycle ? <ArchiveSettings lifecycle={controller.lifecycle} /> : null; }

function TemplatePicker({ template, settings, controller, pending, error, onClose, onSave, onSaved }: { template: keyof FocusFlowSettings['templates'] | null; settings: FocusFlowSettings; controller: SettingsController; pending: boolean; error: string | null; onClose: () => void; onSave: SaveSettings; onSaved: () => void }) {
  if (!template) return null;
  const choose = (path: string) => { void onSave((current) => ({ ...current, templates: { ...current.templates, [template]: path } })).then((saved) => { if (saved) onSaved(); }); };
  return <VaultPathPicker title={`Choose ${template} template`} folders={controller.listFolders?.() ?? []} files={controller.listTemplateFiles?.() ?? Object.values(settings.templates)} initialFolder={settings.templates[template].split('/').slice(0, -1).join('/')} disabled={pending} error={error} action="Use template" onClose={onClose} onChoose={choose} />;
}

function SettingsMessage({ message, visible }: { message: string | null; visible: boolean }) { return message && visible ? <p aria-live="polite" className="focus-flow__settings-message">{message}</p> : null; }

function LimitEditor({ label, policy, pending, error, onClose, onSave }: {
  label: string;
  policy: { mode: WipEnforcement; limit: number };
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (policy: { mode: WipEnforcement; limit: number }) => Promise<void>;
}) {
  const [mode, setMode] = useState(policy.mode);
  const [limit, setLimit] = useState(String(policy.limit));
  const inputRef = useRef<HTMLInputElement>(null);
  const valid = mode === 'off' || Number.isInteger(Number(limit)) && Number(limit) > 0;
  return <DialogSurface title={`${label} limit`} initialFocusRef={inputRef} onClose={onClose}>
    <form className="focus-flow__limit-editor" onSubmit={(event) => { event.preventDefault(); if (valid) void onSave({ mode, limit: mode === 'off' ? policy.limit : Number(limit) }); }}>
      <div className="focus-flow__limit-modes" role="group" aria-label="Limit behavior">{([{ value: 'off', label: 'No limit' }, { value: 'soft', label: 'Ask first' }, { value: 'hard', label: 'Enforce' }] as const).map((option) => <button type="button" key={option.value} aria-pressed={mode === option.value} disabled={pending} onClick={() => setMode(option.value)}>{option.label}</button>)}</div>
      {mode !== 'off' && <label className="focus-flow__limit-number"><input ref={inputRef} aria-label={`${label} limit`} type="number" min="1" step="1" required disabled={pending} value={limit} onChange={(event) => setLimit(event.currentTarget.value)} /><span>Tasks</span></label>}
      <p className="focus-flow__report-caption">{mode === 'off' ? 'No cap on the number of Tasks.' : mode === 'soft' ? 'Ask before going over this limit.' : 'Block changes that go over this limit.'}</p>
      {error && <p role="alert">{error}</p>}
      <button className="focus-flow__button-primary" disabled={pending || !valid} type="submit">{pending ? 'Saving…' : 'Save'}</button>
    </form>
  </DialogSurface>;
}
