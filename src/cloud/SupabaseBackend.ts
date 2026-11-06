import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeProfile } from '../profile/Profile.ts';
import { CloudError, type CloudBackend, type CloudProfile, type PendingOperation } from './contracts.ts';

export class SupabaseBackend implements CloudBackend {
  private readonly client: SupabaseClient;
  private readonly owner: string;
  constructor(client: SupabaseClient, owner: string) { this.client = client; this.owner = owner; }
  load(): Promise<CloudProfile> { return this.rpc('bp_load_profile', {}); }
  apply(op: PendingOperation): Promise<CloudProfile> {
    switch (op.kind) {
      case 'profile': return this.rpc('bp_apply_profile', { p_id: op.id, p_revision: op.revision, p_generation: op.generation, p_patch: op.patch });
      case 'run': return this.rpc('bp_report_run', { p_id: op.id, p_generation: op.generation, p_report: op.report });
      case 'import': return this.rpc('bp_import_local', { p_id: op.id, p_generation: op.generation, p_legacy_id: op.legacyId, p_profile: op.profile });
    }
  }
  reset(revision: number, operationId: string): Promise<CloudProfile> {
    return this.rpc('bp_reset_progress', { p_revision: revision, p_id: operationId });
  }
  private async rpc(name: string, args: Record<string, unknown>): Promise<CloudProfile> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      // p_owner is checked against auth.uid() in every function, including after a tab changes account.
      const { data, error } = await this.client.rpc(name, { ...args, p_owner: this.owner }).abortSignal(controller.signal);
      if (error) {
        if (error.message.includes('REVISION_CONFLICT')) throw new CloudError('El perfil cambió en otro dispositivo. Elegí qué cambios conservar.', 'conflict');
        if (error.message.includes('GENERATION_CHANGED')) throw new CloudError('El progreso fue reiniciado desde otro dispositivo.', 'generation');
        if (error.code === '42501' || error.code === 'P0001' || error.code?.startsWith('22') || error.code?.startsWith('23')) {
          throw new CloudError('El servidor rechazó este cambio. Revisá tu cuenta y los cambios pendientes.', 'rejected');
        }
        throw new CloudError('No se pudo contactar con el servidor. Tus cambios siguen pendientes.');
      }
      if (!data || typeof data.revision !== 'number' || typeof data.generation !== 'number' || !data.profile || !data.preferences) {
        throw new CloudError('La respuesta del servidor no es válida.', 'rejected');
      }
      return { ...data, profile: sanitizeProfile(data.profile) } as CloudProfile;
    } finally { clearTimeout(timer); }
  }
}
