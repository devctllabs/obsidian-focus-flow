#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { v7 as uuidV7 } from 'uuid';
import { WorkIndex } from '../application/indexing/work-index';
import { uncatalogedTagDiagnostics } from '../application/tags/catalog-diagnostics';
import { WorkCreationService } from '../application/work/create-work';
import { parseTagCatalog } from '../domain/tag-catalog';
import { normalizeSettings } from '../settings';
import {
  FilesystemTemplateRenderer,
  FilesystemWorkCreator,
  FilesystemWorkNoteRepository,
} from './filesystem-vault';

export interface CliIo {
  stdout: (value: string) => void;
  stderr: (value: string) => void;
  now: () => string;
  nextId: () => string;
  today?: () => string;
}

const defaultIo: CliIo = {
  stdout: (value) => process.stdout.write(value),
  stderr: (value) => process.stderr.write(value),
  now: () => new Date().toISOString(),
  nextId: uuidV7,
  today: () => localDate(new Date()),
};

export async function runCli(
  argv: readonly string[],
  io: CliIo = defaultIo,
): Promise<number> {
  let json = argv.includes('--json');
  try {
    const command = parseCommand(argv);
    json = command.json;
    const context = await createContext(command.vault, io);
    if (command.kind === 'check') {
      return runCheck(context.index, context.repository, command.json, io);
    }
    if (command.kind === 'create-candidate') {
      const path = await context.creation.captureCandidate(command.title);
      await context.index.refresh();
      const entity = context.index.getSnapshot().entities.find(
        (candidate) => candidate.path === path,
      );
      writeSuccess({ json: command.json, command: 'create candidate', entity, message: `Created Candidate ${entityKey(entity)} at ${path}.`, io });
      return 0;
    }

    await context.index.refresh();
    const stories = context.index.getSnapshot().entities.filter(
      (entity) => entity.type === 'story' && entity.key === command.story,
    );
    if (stories.length !== 1) {
      throw new Error(
        stories.length === 0
          ? `Story ${command.story} was not found.`
          : `Story key ${command.story} is not unique.`,
      );
    }
    const result = await context.creation.createTask(
      stories[0]!.id,
      command.title,
      command.confirmWipExcess,
    );
    if (result.kind !== 'created') {
      writeFailure(command.json, 'create task', result.message, io);
      return 1;
    }
    await context.index.refresh();
    const entity = context.index.getSnapshot().entities.find(
      (candidate) => candidate.path === result.path,
    );
    writeSuccess({ json: command.json, command: 'create task', entity, message: `Created Task ${entityKey(entity)} at ${result.path}.`, io });
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      writeUsage(json, error.message, io);
      return 2;
    }
    const message = error instanceof Error ? error.message : 'Unknown error.';
    writeFailure(json, 'error', message, io);
    return 1;
  }
}

type ParsedCommand =
  | { kind: 'check'; vault: string; json: boolean }
  | {
      kind: 'create-candidate';
      vault: string;
      title: string;
      json: boolean;
    }
  | {
      kind: 'create-task';
      vault: string;
      story: string;
      title: string;
      confirmWipExcess: boolean;
      json: boolean;
    };

function parseCommand(argv: readonly string[]): ParsedCommand {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        vault: { type: 'string' },
        title: { type: 'string' },
        story: { type: 'string' },
        json: { type: 'boolean', default: false },
        'confirm-wip-excess': { type: 'boolean', default: false },
      },
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : 'Invalid arguments.');
  }
  const vault = required(parsed.values.vault, '--vault');
  const [first, second, ...extra] = parsed.positionals;
  if (extra.length > 0) throw new UsageError('Too many command arguments.');
  if (first === 'check' && second === undefined) {
    rejectOptions(parsed.values, ['vault', 'json']);
    return { kind: 'check', vault, json: parsed.values.json };
  }
  if (first === 'create' && second === 'candidate') {
    rejectOptions(parsed.values, ['vault', 'json', 'title']);
    return {
      kind: 'create-candidate',
      vault,
      title: required(parsed.values.title, '--title'),
      json: parsed.values.json,
    };
  }
  if (first === 'create' && second === 'task') {
    rejectOptions(parsed.values, [
      'vault',
      'json',
      'title',
      'story',
      'confirm-wip-excess',
    ]);
    return {
      kind: 'create-task',
      vault,
      story: required(parsed.values.story, '--story'),
      title: required(parsed.values.title, '--title'),
      confirmWipExcess: parsed.values['confirm-wip-excess'],
      json: parsed.values.json,
    };
  }
  throw new UsageError('Unknown command.');
}

async function createContext(vaultInput: string, io: CliIo) {
  const vault = resolve(vaultInput);
  const settingsPath = resolve(
    vault,
    '.obsidian/plugins/focus-flow/data.json',
  );
  let storedSettings: unknown;
  try {
    storedSettings = JSON.parse(await readFile(settingsPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Could not read Focus Flow settings at ${settingsPath}: ${
        error instanceof Error ? error.message : 'invalid settings'
      }`,
    );
  }
  const settings = normalizeSettings(storedSettings);
  const repository = new FilesystemWorkNoteRepository(
    vault,
    settings.rootFolder,
  );
  const index = new WorkIndex(
    repository,
    {
      yieldToMain: async () => undefined,
      getWipPolicies: () => settings.wip,
    },
  );
  const creation = new WorkCreationService({
    writer: new FilesystemWorkCreator(vault, settings.rootFolder),
    index,
    templates: new FilesystemTemplateRenderer(vault, settings),
    nextId: io.nextId,
    now: io.now,
    getScopePolicy: () => settings.wip.sprintScope,
    getLocalDate: io.today,
  });
  return { index, creation, repository };
}

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function runCheck(
  index: WorkIndex,
  repository: FilesystemWorkNoteRepository,
  json: boolean,
  io: CliIo,
): Promise<number> {
  await index.refresh();
  const snapshot = index.getSnapshot();
  if (snapshot.phase === 'error') {
    writeFailure(
      json,
      'check',
      snapshot.errorMessage ?? 'Focus Flow could not check the vault.',
      io,
    );
    return 1;
  }
  const catalogSource = await repository.readTagCatalog();
  const catalog = parseTagCatalog(catalogSource.body);
  const diagnostics: CliDiagnostic[] = snapshot.diagnostics.map((diagnostic) => ({
    ...diagnostic,
    severity: diagnosticSeverity(diagnostic),
  }));
  diagnostics.push(
    ...catalog.diagnostics.map((message) => ({
      code: 'invalid-tag-catalog' as const,
      message,
      path: catalogSource.path,
      severity: 'warning' as const,
    })),
    ...uncatalogedTagDiagnostics(snapshot.entities, catalog).map(
      (diagnostic) => ({
        ...diagnostic,
        severity: diagnosticSeverity(diagnostic),
      }),
    ),
  );
  const errors = diagnostics.filter(({ severity }) => severity === 'error');
  if (json) {
    io.stdout(`${JSON.stringify({ ok: errors.length === 0, command: 'check', diagnostics })}\n`);
  } else if (diagnostics.length === 0) {
    io.stdout('Vault is consistent.\n');
  } else {
    for (const diagnostic of diagnostics) {
      io.stdout(`${diagnostic.severity.toUpperCase()} ${diagnostic.code}: ${diagnostic.message}\n`);
    }
  }
  return errors.length === 0 ? 0 : 1;
}

function diagnosticSeverity(
  diagnostic: { code: string; severity?: 'warning' | 'error' },
): 'warning' | 'error' {
  return diagnostic.severity ??
    (diagnostic.code === 'missing-mission' ? 'warning' : 'error');
}

interface CliDiagnostic {
  code: string;
  message: string;
  path: string;
  severity: 'warning' | 'error';
}

function writeSuccess(
  { json, command, entity, message, io }: { json: boolean; command: string; entity: unknown; message: string; io: CliIo },
): void {
  io.stdout(
    json
      ? `${JSON.stringify({ ok: true, command, entity })}\n`
      : `${message}\n`,
  );
}

function writeFailure(
  json: boolean,
  command: string,
  message: string,
  io: CliIo,
): void {
  const output = json
    ? `${JSON.stringify({ ok: false, command, error: message })}\n`
    : `Error: ${message}\n`;
  (json ? io.stdout : io.stderr)(output);
}

function writeUsage(json: boolean, message: string, io: CliIo): void {
  const usage =
    'Usage: focus-flow <create candidate|create task|check> --vault <path> [options]';
  if (json) {
    io.stdout(`${JSON.stringify({ ok: false, command: 'usage', error: message, usage })}\n`);
  } else {
    io.stderr(`${message}\n${usage}\n`);
  }
}

function entityKey(entity: unknown): string {
  return typeof entity === 'object' && entity !== null && 'key' in entity
    ? String(entity.key)
    : 'unknown';
}

function required(value: string | undefined, option: string): string {
  if (value === undefined || value.trim() === '') {
    throw new UsageError(`${option} is required.`);
  }
  return value;
}

function rejectOptions(
  values: Record<string, string | boolean | undefined>,
  allowed: readonly string[],
): void {
  for (const [name, value] of Object.entries(values)) {
    if (!allowed.includes(name) && value !== undefined && value !== false) {
      throw new UsageError(`--${name} is not valid for this command.`);
    }
  }
}

class UsageError extends Error {}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  process.exitCode = await runCli(process.argv.slice(2));
}
