import type { Accounts } from '../cloud/Accounts';

export function syncLabel(accounts: Accounts): string {
  if (accounts.initializing) return 'CARGANDO CUENTA…';
  if (accounts.isGuest) return 'INVITADO · PROGRESO LOCAL';
  const sync = accounts.sync;
  if (!sync.localDurable && sync.pendingCount) return 'CAMBIOS PENDIENTES · MANTENÉ ESTA PÁGINA ABIERTA';
  switch (sync.status) {
    case 'loading': return 'CARGANDO PERFIL…';
    case 'saving': return `GUARDANDO · ${sync.pendingCount} CAMBIOS PENDIENTES`;
    case 'saved': return 'GUARDADO EN SERVIDOR';
    case 'offline': return sync.ready ? (sync.pendingCount ? 'SIN CONEXIÓN · CAMBIOS PENDIENTES' : 'SIN CONEXIÓN · PERFIL EN ESTE DISPOSITIVO') : 'NO SE PUDO CARGAR EL PERFIL';
    case 'conflict': return 'CAMBIOS EN OTRO DISPOSITIVO · REVISÁ TU CUENTA';
    case 'error': return 'NO SE PUDO GUARDAR · REVISÁ TU CUENTA';
    default: return 'CUENTA CONECTADA';
  }
}
