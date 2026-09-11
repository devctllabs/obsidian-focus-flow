import { z } from 'zod';
import { uuidV7Schema } from './managed-schema';

export type ManagedBlock = Record<string, unknown>;
export interface ManagedState { path: string; managed: ManagedBlock }
export interface ManagedReplacement { id: string; before: ManagedState; after: ManagedState }

const safePath = z.string().refine((path) => path.endsWith('.md') && !path.startsWith('/') && !path.includes('\\') && !path.split('/').some((part) => !part || part === '.' || part === '..'));
const stateSchema = z.object({ path: safePath, managed: z.record(z.string(), z.unknown()) });
export const replacementSchema = z.object({ id: uuidV7Schema, before: stateSchema, after: stateSchema }).refine((entry) => entry.before.managed.id === entry.id && entry.after.managed.id === entry.id);
export const reopenRecoverySchema = z.object({
  close_operation_id: uuidV7Schema,
  provisional_story_outcomes: z.array(z.unknown()),
  notes: z.array(z.object({ id: uuidV7Schema, before_close: z.object({ path: safePath, focus_flow: z.record(z.string(), z.unknown()) }), expected_after_close: z.object({ path: safePath, focus_flow: z.record(z.string(), z.unknown()) }) })),
}).refine((recovery) => new Set(recovery.notes.map((entry) => entry.id)).size === recovery.notes.length && recovery.notes.every((entry) => entry.before_close.focus_flow.id === entry.id && entry.expected_after_close.focus_flow.id === entry.id));
export type ReopenRecovery = z.infer<typeof reopenRecoverySchema>;

/** YAML mappings are unordered; omission and explicit null are deliberately different. */
export function managedEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => managedEqual(item, right[index]));
  if (!isManagedRecord(left) || !isManagedRecord(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && managedEqual(left[key], right[key]));
}
export function isManagedRecord(value: unknown): value is ManagedBlock {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
