import type { Profile, RunSummary } from '../profile/Profile.ts';
import type { CosmeticLook } from '../profile/cosmetics.ts';

export interface ProfilePatch {
  name?: string;
  lastCharacter?: string;
  equipped?: Record<string, CosmeticLook>;
  preferences?: { volume: number; muted: boolean };
}
export interface CloudProfile {
  profile: Profile;
  revision: number;
  generation: number;
  imported: boolean;
  preferences: { volume: number; muted: boolean };
  updatedAt: string;
}
export interface RunReport extends RunSummary {
  generation?: number;
  runId: string;
  seq: number;
  seed: number;
  finished: boolean;
}
export type PendingOperation =
  | { id: string; kind: 'profile'; patch: ProfilePatch; revision: number; generation: number }
  | { id: string; kind: 'run'; report: RunReport; generation: number }
  | { id: string; kind: 'import'; profile: Profile; legacyId: string; generation: number };

export interface CloudBackend {
  load(): Promise<CloudProfile>;
  apply(operation: PendingOperation): Promise<CloudProfile>;
  reset(revision: number, operationId: string): Promise<CloudProfile>;
}
export class CloudError extends Error {
  readonly code: 'conflict' | 'generation' | 'rejected' | 'network';
  constructor(message: string, code: CloudError['code'] = 'network') { super(message); this.code = code; }
}
export function applyPatch(profile: Profile, patch: ProfilePatch): Profile {
  return { ...profile, ...(patch.name === undefined ? {} : { name: patch.name }),
    ...(patch.lastCharacter === undefined ? {} : { lastCharacter: patch.lastCharacter }),
    cosmetics: { ...profile.cosmetics, equipped: { ...profile.cosmetics.equipped, ...patch.equipped } } };
}
