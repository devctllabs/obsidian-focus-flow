import {
  normalizePath,
  TFile,
  type FileManager,
  type Vault,
} from 'obsidian';
import type {
  CandidateTriagePlan,
  CandidateTriageWriter,
} from '../../application/work/triage-candidate';
import { noteFilename } from '../../domain/note-filename';
import { parseDocument } from 'yaml';
import { readBodyFields, sameBodyFields, writeBodyFields } from '../../application/work/work-body-fields';

export class ObsidianCandidateTriageWriter implements CandidateTriageWriter {
  constructor(
    private readonly vault: Pick<
      Vault,
      'getAbstractFileByPath' | 'createFolder' | 'process'
    >,
    private readonly fileManager: Pick<
      FileManager,
      'processFrontMatter' | 'renameFile'
    >,
    private readonly getRootFolder: () => string,
  ) {}

  async apply(plan: CandidateTriagePlan): Promise<string> {
    const folder = normalizePath(
      `${this.getRootFolder()}/${targetFolder(plan)}`,
    );
    const destinationPath = normalizePath(
      `${folder}/${noteFilename(plan.key, plan.title)}`,
    );
    const source = this.vault.getAbstractFileByPath(normalizePath(plan.path));
    const destination = this.vault.getAbstractFileByPath(destinationPath);
    if (source instanceof TFile && destination !== null) {
      throw new Error('Focus Flow triage destination already exists.');
    }
    const file = source instanceof TFile ? source : destination;
    if (!(file instanceof TFile)) {
      throw new Error('Focus Flow Candidate was not found.');
    }

    await this.ensureFolder(folder);
    const updateProperties = (frontmatter: Record<string, unknown>) => {
        const managed: unknown = frontmatter.focus_flow;
        if (
          !isRecord(managed) ||
          managed.id !== plan.id ||
          managed.key !== plan.key
        ) {
          throw new Error('Focus Flow Candidate changed before triage.');
        }
        if (matchesPlan(managed, plan)) return;
        const expectedLifecycle = plan.kind === 'reconsider-candidate'
          ? 'rejected'
          : 'inbox';
        if (
          managed.type !== 'candidate' ||
          managed.lifecycle !== expectedLifecycle
        ) {
          throw new Error('Focus Flow Candidate changed before triage.');
        }
        applyPlan(managed, plan);
      };
    const authoring = 'authoring' in plan ? plan.authoring : undefined;
    if (!authoring) await this.fileManager.processFrontMatter(file, updateProperties);
    else await this.vault.process(file, (content) => {
      const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
      if (!match) throw new Error('Candidate properties changed. Reopen the form.');
      const document = parseDocument(match[1]!);
      if (document.errors.length) throw new Error('Resolve the note’s properties before accepting it.');
      const frontmatter = document.toJS() as Record<string, unknown>;
      const body = content.slice(match[0].length);
      const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String).map((tag) => tag.replace(/^#/, '')).sort() : [];
      const desiredTags = [...new Set(authoring.tags.map((tag) => tag.trim().replace(/^#+/, '')).filter(Boolean))];
      if ((!sameBodyFields(readBodyFields(body), authoring.expected.bodyFields) && !sameBodyFields(readBodyFields(body), authoring.bodyFields)) || (JSON.stringify(tags) !== JSON.stringify([...authoring.expected.tags].sort()) && JSON.stringify(tags) !== JSON.stringify([...desiredTags].sort()))) throw new Error('Candidate changed. Reopen the form to load its latest fields.');
      updateProperties(frontmatter);
      const managed = frontmatter.focus_flow as Record<string, unknown>;
      for (const [key, value] of Object.entries(managed)) document.setIn(['focus_flow', key], value);
      document.set('tags', desiredTags);
      const eol = content.includes('\r\n') ? '\r\n' : '\n';
      return `---${eol}${document.toString().replace(/\r?\n/g, eol)}---${eol}${writeBodyFields(body, authoring.bodyFields)}`;
    });

    if (source instanceof TFile) {
      await this.fileManager.renameFile(source, destinationPath);
    }
    return destinationPath;
  }

  private async ensureFolder(path: string): Promise<void> {
    const segments = path.split('/');
    for (let length = 1; length <= segments.length; length += 1) {
      const current = segments.slice(0, length).join('/');
      if (this.vault.getAbstractFileByPath(current) === null) {
        await this.vault.createFolder(current);
      }
    }
  }
}

function targetFolder(plan: CandidateTriagePlan): string {
  if (plan.kind === 'accept-candidate-as-epic') return 'Epics';
  if (plan.kind === 'accept-candidate-as-story') return 'Stories';
  if (plan.kind === 'reconsider-candidate') return 'Inbox';
  return 'Distractions';
}

function matchesPlan(
  managed: Record<string, unknown>,
  plan: CandidateTriagePlan,
): boolean {
  if (plan.kind === 'accept-candidate-as-epic') {
    return matchesAcceptedEpic(managed, plan);
  }
  if (plan.kind === 'accept-candidate-as-story') {
    return matchesAcceptedStory(managed, plan);
  }
  if (plan.kind === 'reconsider-candidate') {
    return matchesReconsidered(managed);
  }
  return matchesRejected(managed, plan);
}

function matchesAcceptedEpic(managed: Record<string, unknown>, plan: Extract<CandidateTriagePlan, { kind: 'accept-candidate-as-epic' }>): boolean {
  return managed.type === 'epic' && managed.lifecycle === 'backlog' && managed.backlog_rank === plan.backlogRank;
}

function matchesReconsidered(managed: Record<string, unknown>): boolean {
  return managed.type === 'candidate' && managed.lifecycle === 'inbox';
}

function matchesRejected(managed: Record<string, unknown>, plan: Extract<CandidateTriagePlan, { kind: 'reject-candidate' }>): boolean {
  return managed.type === 'candidate' && managed.lifecycle === 'rejected' && managed.rejected_at === plan.rejectedAt && (managed.rejection_reason ?? null) === plan.rejectionReason;
}

function matchesAcceptedStory(managed: Record<string, unknown>, plan: Extract<CandidateTriagePlan, { kind: 'accept-candidate-as-story' }>): boolean {
  const lifecycle = plan.backlogRank === null ? 'epic_backlog' : 'backlog';
  return managed.type === 'story' && managed.lifecycle === lifecycle && managed.epic_id === plan.epicId && managed.epic_link === plan.epicLink && (managed.backlog_rank ?? null) === plan.backlogRank;
}

function applyPlan(
  managed: Record<string, unknown>,
  plan: CandidateTriagePlan,
): void {
  if (plan.kind === 'reconsider-candidate') {
    managed.lifecycle = 'inbox';
    delete managed.rejected_at;
    delete managed.rejection_reason;
    return;
  }
  if (plan.kind === 'accept-candidate-as-epic') {
    managed.type = 'epic';
    managed.lifecycle = 'backlog';
    managed.backlog_rank = plan.backlogRank;
  } else if (plan.kind === 'accept-candidate-as-story') {
    managed.type = 'story';
    managed.lifecycle = plan.backlogRank === null ? 'epic_backlog' : 'backlog';
    managed.epic_id = plan.epicId;
    managed.epic_link = plan.epicLink;
    if (plan.backlogRank === null) delete managed.backlog_rank;
    else managed.backlog_rank = plan.backlogRank;
  } else {
    managed.lifecycle = 'rejected';
    managed.rejected_at = plan.rejectedAt;
    if (plan.rejectionReason === null) {
      delete managed.rejection_reason;
    } else {
      managed.rejection_reason = plan.rejectionReason;
    }
    return;
  }
  delete managed.rejected_at;
  delete managed.rejection_reason;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
