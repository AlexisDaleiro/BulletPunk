import type { SupabaseClient } from '@supabase/supabase-js';
import type { CloudProfile, RunReport } from '../cloud/contracts';
import type { RunSnapshot } from './RunSnapshot';

export interface CheckpointRecord {
  runId: string;
  revision: number;
  generation: number;
  clientId: string;
  leaseUntil: string | null;
  updatedAt: string;
  version: number;
  worldVersion: number;
  floor: number;
  characterId: string;
  elapsed: number;
  payload: RunSnapshot | null;
}
export interface CheckpointReply {
  profile: CloudProfile;
  save: CheckpointRecord | null;
}
export interface CheckpointCommand {
  action: 'inspect' | 'start' | 'claim' | 'save' | 'heartbeat' | 'release' | 'finish';
  clientId: string;
  operationId: string;
  runId?: string;
  revision?: number;
  takeover?: boolean;
  replaceRunId?: string;
  replaceRevision?: number;
  payload?: RunSnapshot;
  report?: RunReport;
}
export class CheckpointError extends Error {
  readonly code: 'busy' | 'lost' | 'changed' | 'invalid' | 'network';
  constructor(message: string, code: CheckpointError['code']) {
    super(message);
    this.code = code;
  }
}
export async function checkpointRpc(
  client: SupabaseClient,
  owner: string,
  request: CheckpointCommand,
): Promise<CheckpointReply> {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
  try {
    const { data, error } = await client
      .rpc('bp_checkpoint', { p_owner: owner, p_request: request })
      .abortSignal(controller.signal);
    if (error) {
      if (error.message.includes('LEASE_BUSY'))
        throw new CheckpointError(
          'Esta incursión está abierta en otro dispositivo o pestaña. Podés continuar aquí y detener esa sesión.',
          'busy',
        );
      if (
        error.message.includes('LEASE_LOST') ||
        error.message.includes('SAVE_UNAVAILABLE') ||
        error.message.includes('GENERATION_CHANGED')
      )
        throw new CheckpointError(
          'La incursión cambió de sesión o ya no está disponible. Se detuvo esta copia para proteger el guardado.',
          'lost',
        );
      if (error.message.includes('SAVE_CHANGED'))
        throw new CheckpointError(
          'Hay una versión más reciente en el servidor. Revisá el guardado antes de continuar.',
          'changed',
        );
      if (
        error.code === 'P0001' ||
        error.code === '42501' ||
        error.code?.startsWith('22') ||
        error.code?.startsWith('23')
      )
        throw new CheckpointError('El servidor no pudo aceptar este guardado. La copia local se conservó.', 'invalid');
      throw new CheckpointError('Sin conexión con el servidor de guardado. La copia local se conservó.', 'network');
    }
    if (!data?.profile || !('save' in data))
      throw new CheckpointError('La respuesta del guardado no es válida.', 'invalid');
    return data as CheckpointReply;
  } finally {
    clearTimeout(timer);
  }
}
