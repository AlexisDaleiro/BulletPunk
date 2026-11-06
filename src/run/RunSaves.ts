import type { Accounts } from '../cloud/Accounts';
import type { RunReport } from '../cloud/contracts';
import { browserStorage, readJson, writeJson, type KV } from '../core/storage';
import { createId } from '../core/id';
import type { Game } from '../core/Game';
import type { System } from '../ecs/System';
import type { InputManager } from '../input/InputManager';
import type { RunController } from './RunController';
import { captureWorld, restoreWorld, type SnapshotDeps } from './SnapshotWorld';
import { parseRunSnapshot, type RunSnapshot } from './RunSnapshot';
import {
  checkpointRpc,
  CheckpointError,
  type CheckpointCommand,
  type CheckpointRecord,
  type CheckpointReply,
} from './checkpointApi';

interface LocalCheckpoint {
  confirmed: RunSnapshot | null;
  pending: RunSnapshot | null;
  revision: number;
  clientId: string;
  operation: CheckpointCommand | null;
  terminal: RunReport | null;
}
export interface CheckpointPreview {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  weapons: string[];
  activeSlot: number;
}
const empty = (): LocalCheckpoint => ({
  confirmed: null,
  pending: null,
  revision: 0,
  clientId: '',
  operation: null,
  terminal: null,
});
const key = (owner: string | null): string => `bulletpunk.checkpoint.${owner ?? 'guest'}`;
export interface RunSaveDeps extends SnapshotDeps {
  accounts: Accounts;
  run: RunController;
  game: Game;
  input: InputManager;
  isMenuOpen: () => boolean;
}

/** Snapshots, their acknowledgements and lease tokens are independent of profile editing. */
export class RunSaves implements System {
  private remotePreview: CheckpointPreview | null = null;
  private previewRevision = '';
  get preview(): CheckpointPreview | null {
    const snapshot = this.record.confirmed;
    if (
      snapshot &&
      (!this.owner || (snapshot.run.runId === this.summary?.runId && this.record.revision === this.summary.revision))
    ) {
      const player = snapshot.entities.find((e) => e.kind === 'player'),
        h = player?.data.health,
        w = player?.weapons;
      if (h && w)
        return {
          hp: h.hp,
          maxHp: h.maxHp,
          shield: h.shield,
          maxShield: h.maxShield,
          weapons: w.slots,
          activeSlot: w.activeSlot,
        };
    }
    return this.remotePreview;
  }
  status: 'loading' | 'ready' | 'saving' | 'saved' | 'offline' | 'busy' | 'lost' | 'conflict' | 'error' = 'ready';
  error = '';
  summary: CheckpointRecord | null = null;
  onReady: (() => void) | null = null;
  onNotice: (() => void) | null = null;
  private readonly deps: RunSaveDeps;
  private readonly storage: KV | null;
  private owner: string | null = null;
  private record: LocalCheckpoint = empty();
  private readonly clientId = createId();
  private epoch = 0;
  private chain: Promise<void> = Promise.resolve();
  private requested = false;
  private restoring = false;
  private started = false;
  private known = false;
  private leaseDeadline = 0;
  private lastHeartbeat = 0;
  private lastRefresh = 0;
  private readonly listeners = new Set<() => void>();

  constructor(deps: RunSaveDeps, storage: KV | null = browserStorage()) {
    this.deps = deps;
    this.storage = storage;
    this.readLocal();
    deps.accounts.subscribe(() => {
      if (this.owner !== deps.accounts.userId) {
        this.owner = deps.accounts.userId;
        this.epoch++;
        this.chain = Promise.resolve();
        this.summary = null;
        this.remotePreview = null;
        this.previewRevision = '';
        this.known = false;
        this.started = false;
        this.leaseDeadline = 0;
        this.readLocal();
        this.notify();
      }
      if (!deps.accounts.initializing && (!this.owner || deps.accounts.sync.ready) && !this.started) {
        this.started = true;
        void this.refresh();
      }
    });
    window.setInterval(() => {
      void this.tickLease();
    }, 2000);
    window.addEventListener('pagehide', () => {
      this.checkpointNow();
      void this.flush();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.requestSave();
    });
  }
  get hasSaved(): boolean {
    return this.owner
      ? this.known
        ? this.summary !== null
        : !!(this.record.confirmed || this.record.pending)
      : !!this.record.confirmed;
  }
  get canResume(): boolean {
    return (
      this.hasSaved &&
      !this.record.terminal &&
      !['loading', 'saving'].includes(this.status) &&
      this.deps.accounts.canPlay
    );
  }
  get savedAt(): string | null {
    return this.summary?.updatedAt ?? this.record.confirmed?.savedAt ?? null;
  }
  get savedFloor(): number {
    return this.summary?.floor ?? this.record.pending?.level.floor ?? this.record.confirmed?.level.floor ?? 1;
  }
  get savedCharacterId(): string | null {
    return this.summary?.characterId ?? this.record.confirmed?.run.characterId ?? null;
  }
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  label(): string {
    if (this.error) return this.error;
    if (this.status === 'loading') return 'Cargando incursión…';
    if (this.status === 'saving') return 'Guardando incursión…';
    if (this.record.pending)
      return this.owner ? 'Incursión pendiente de guardar en servidor.' : 'Guardado pendiente en este dispositivo.';
    if (!this.hasSaved) return 'Sin incursión guardada.';
    const time = this.savedAt
      ? new Date(this.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    return `Piso ${this.savedFloor} · ${this.owner ? 'Guardado en servidor' : 'Guardado en este dispositivo'}${time ? ` · ${time}` : ''}`;
  }
  afterStep(): void {
    if (this.requested) this.checkpointNow();
  }
  requestSave(): void {
    if (this.deps.run.practice) return;
    if (this.restoring || !this.deps.run.active || this.deps.run.over) return;
    this.requested = true;
    queueMicrotask(() => {
      if (this.requested && !this.deps.game.stepping) this.checkpointNow();
    });
  }
  report(report: RunReport): void {
    if (report.finished) {
      this.finish(report);
      return;
    }
    this.requestSave();
  }
  newRun(replace: boolean): void {
    const previous = this.summary;
    this.deps.game.setPause('checkpoint', true);
    this.deps.input.setActive(false);
    this.status = 'loading';
    this.error = '';
    this.requested = false;
    this.notify();
    let snapshot: RunSnapshot;
    try {
      snapshot = captureWorld(this.deps, this.deps.run.checkpointMeta());
    } catch (error) {
      this.fail(error);
      this.deps.run.invalidateRun();
      this.deps.game.setPause('checkpoint', false);
      this.onNotice?.();
      return;
    }
    void this.enqueue(
      async (epoch) => {
        if (this.owner) {
          await this.recoverOperation(epoch);
          const command = this.command('start');
          command.payload = snapshot;
          if (replace && previous) {
            command.replaceRunId = previous.runId;
            command.replaceRevision = previous.revision;
          }
          const reply = await this.remote(command, epoch);
          this.confirm(reply, snapshot);
          this.record.pending = null;
          this.persist();
        } else {
          this.record = { ...empty(), confirmed: snapshot, clientId: this.clientId };
          this.persist();
          this.status = 'saved';
        }
        if (epoch !== this.epoch) return;
        this.requested = false;
        this.unlock();
        this.notify();
      },
      () => {
        this.deps.run.invalidateRun();
        this.deps.game.setPause('checkpoint', false);
        this.onNotice?.();
      },
    );
  }
  async refresh(): Promise<void> {
    this.lastRefresh = Date.now();
    if (!this.owner) {
      this.known = true;
      this.status = this.hasSaved ? 'saved' : 'ready';
      this.notify();
      return;
    }
    await this.enqueue(async (epoch) => {
      const attention =
        this.status === 'busy' || this.status === 'conflict' ? { status: this.status, error: this.error } : null;
      if (!this.known) {
        this.status = 'loading';
        this.notify();
      }
      // Replay an unacknowledged command first; its stable ID prevents duplicate progress.
      if (this.record.operation) {
        try {
          const reply = await this.remote(this.record.operation, epoch);
          this.confirm(reply, this.record.operation.payload ?? undefined, this.record.operation.clientId);
        } catch (error) {
          if (!(error instanceof CheckpointError) || !['lost', 'changed'].includes(error.code)) throw error;
          this.record.operation = null;
          this.persist();
        }
      }
      const reply = await this.remote(this.command('inspect'), epoch);
      this.summary = reply.save;
      this.known = true;
      if (!this.summary) this.remotePreview = null;
      if (
        this.summary &&
        `${this.summary.runId}:${this.summary.revision}` !== this.previewRevision &&
        !(this.record.confirmed?.run.runId === this.summary.runId && this.record.revision === this.summary.revision)
      ) {
        this.remotePreview = null;
        const controller = new AbortController(),
          timer = setTimeout(() => controller.abort(), 5000);
        try {
          const preview = await this.deps.accounts
            .client!.from('bp_checkpoints')
            .select('health:payload->entities->0->data->health,weapons:payload->entities->0->weapons')
            .eq('user_id', this.owner!)
            .abortSignal(controller.signal)
            .maybeSingle();
          if (epoch !== this.epoch) return;
          const h = preview.data?.health as unknown as Record<string, number> | undefined,
            w = preview.data?.weapons as unknown as { slots: string[]; activeSlot: number } | undefined;
          if (
            h &&
            w &&
            Array.isArray(w.slots) &&
            h.maxHp > 0 &&
            [h.hp, h.maxHp, h.shield, h.maxShield].every(Number.isFinite)
          ) {
            this.remotePreview = {
              hp: h.hp,
              maxHp: h.maxHp,
              shield: h.shield,
              maxShield: h.maxShield,
              weapons: w.slots,
              activeSlot: w.activeSlot,
            };
            this.previewRevision = `${this.summary.runId}:${this.summary.revision}`;
          }
        } catch {
          /* The summary remains usable when its optional equipment preview cannot load. */
        } finally {
          clearTimeout(timer);
        }
      }
      if (this.record.terminal && reply.save) {
        const terminal = this.record.terminal;
        if (
          terminal.runId === reply.save.runId &&
          this.record.clientId === reply.save.clientId &&
          this.record.revision === reply.save.revision
        ) {
          const cmd = this.command('finish');
          cmd.clientId = this.record.clientId;
          cmd.runId = terminal.runId;
          cmd.revision = reply.save.revision;
          cmd.report = terminal;
          this.record.operation = cmd;
          this.persist();
          const final = await this.remote(cmd, epoch);
          this.confirm(final);
        } else {
          this.record.terminal = null;
          this.record.operation = null;
          this.persist();
        }
      }
      const keepAttention =
        this.summary &&
        attention &&
        (attention.status === 'busy'
          ? this.summary.clientId !== this.clientId
          : this.record.pending &&
            (this.record.pending.run.runId !== this.summary.runId || this.record.revision !== this.summary.revision));
      this.status = keepAttention ? attention.status : 'ready';
      this.error = keepAttention ? attention.error : '';
      this.notify();
    });
  }
  async resume(takeover = false, useServer = false): Promise<void> {
    await this.enqueue(
      async (epoch) => {
        this.status = 'loading';
        this.error = '';
        this.notify();
        let snapshot: RunSnapshot;
        if (this.owner) {
          const inspected = await this.remote(this.command('inspect'), epoch);
          this.summary = inspected.save;
          this.known = true;
          if (!this.summary) throw new CheckpointError('No queda una incursión disponible en el servidor.', 'lost');
          const cmd = this.command('claim');
          cmd.runId = this.summary.runId;
          cmd.revision = this.summary.revision;
          cmd.takeover = takeover;
          const pending = this.record.pending;
          if (pending && !useServer) {
            if (pending.run.runId !== this.summary.runId || this.record.revision !== this.summary.revision)
              throw new CheckpointError(
                'El servidor tiene otro guardado. Podés continuar desde el servidor y descartar esta copia local pendiente.',
                'changed',
              );
            cmd.payload = parseRunSnapshot(pending);
          }
          const reply = await this.remote(cmd, epoch);
          snapshot = parseRunSnapshot(reply.save?.payload);
          this.confirm(reply, snapshot);
          this.record.pending = null;
          this.record.operation = null;
          this.record.terminal = null;
          this.persist();
        } else {
          snapshot = parseRunSnapshot(this.record.confirmed);
        }
        this.restoring = true;
        this.deps.input.setActive(false);
        this.deps.game.setPause('checkpoint', true);
        try {
          this.deps.run.restoreRun(snapshot.run, () => restoreWorld(this.deps, snapshot));
          this.deps.game.refresh();
        } finally {
          this.restoring = false;
        }
        this.status = 'saved';
        this.error = '';
        this.notify();
        this.deps.game.setPause('checkpoint', false);
        this.onReady?.();
      },
      () => {
        this.deps.game.setPause('checkpoint', false);
        this.onNotice?.();
      },
    );
  }
  async continueLive(): Promise<void> {
    if (this.deps.run.practice && this.deps.run.active) {
      this.onReady?.();
      return;
    }
    if (!this.deps.run.active) {
      await this.resume();
      return;
    }
    this.checkpointNow();
    await this.flush();
    if (this.owner && (this.error || Date.now() >= this.leaseDeadline)) {
      this.onNotice?.();
      return;
    }
    this.deps.game.setPause('checkpoint', false);
    this.onReady?.();
  }
  async suspend(): Promise<void> {
    if (this.deps.run.practice) {
      this.deps.run.quitToMenu();
      this.notify();
      return;
    }
    if (!this.deps.run.active) return;
    this.deps.run.setMenuOpen(true);
    this.checkpointNow();
    await this.flush();
    if (this.owner && this.record.pending)
      throw new Error(this.error || 'El servidor todavía no confirmó la incursión. Reintentá antes de salir.');
    if (this.owner && this.summary) {
      await this.enqueue(async (epoch) => {
        const cmd = this.command('release');
        cmd.runId = this.summary!.runId;
        cmd.revision = this.summary!.revision;
        const reply = await this.remote(cmd, epoch);
        this.summary = reply.save;
      });
    }
    this.deps.run.suspendToMenu();
    this.leaseDeadline = 0;
    this.deps.game.setPause('checkpoint', false);
    this.notify();
  }
  async leaveAccount(): Promise<void> {
    if (!this.deps.run.active) return;
    try {
      await this.suspend();
    } catch {
      this.checkpointNow();
      this.deps.run.suspendToMenu();
      this.deps.game.setPause('checkpoint', false);
    }
  }
  checkpointNow(): void {
    this.requested = false;
    if (this.restoring || !this.deps.run.active || this.deps.run.over || this.deps.run.practice) return;
    if (this.deps.levels.player === null || (this.deps.world.get(this.deps.levels.player, 'health')?.hp ?? 0) <= 0)
      return;
    try {
      const snapshot = captureWorld(this.deps, this.deps.run.checkpointMeta());
      if (!this.owner) {
        this.record.confirmed = snapshot;
        this.record.pending = null;
        this.status = 'saved';
        this.persist();
        this.notify();
        return;
      }
      if (!this.summary || this.summary.runId !== snapshot.run.runId) return;
      this.record.pending = snapshot;
      this.record.clientId = this.clientId;
      this.record.revision = this.summary.revision;
      this.persist();
      this.status = 'saving';
      this.notify();
      void this.enqueue(async (epoch) => {
        await this.recoverOperation(epoch);
        if (!this.summary || this.summary.runId !== snapshot.run.runId) return;
        const cmd = this.command('save');
        cmd.runId = snapshot.run.runId;
        cmd.revision = this.summary!.revision;
        cmd.payload = snapshot;
        this.record.operation = cmd;
        this.persist();
        const reply = await this.remote(cmd, epoch);
        this.confirm(reply, snapshot);
        this.notify();
      });
    } catch (error) {
      this.fail(error);
    }
  }
  flush(): Promise<void> {
    return this.chain;
  }
  private finish(report: RunReport): void {
    this.requested = false;
    if (!this.owner) {
      this.record = empty();
      this.persist();
      this.summary = null;
      this.notify();
      return;
    }
    this.record.terminal = structuredClone(report);
    this.persist();
    void this.enqueue(async (epoch) => {
      await this.recoverOperation(epoch);
      if (!this.summary || this.summary.runId !== report.runId) return;
      const cmd = this.command('finish');
      cmd.runId = report.runId;
      cmd.revision = this.summary.revision;
      cmd.report = report;
      this.record.operation = cmd;
      this.persist();
      const reply = await this.remote(cmd, epoch);
      this.confirm(reply);
      this.notify();
    });
  }
  private async tickLease(): Promise<void> {
    if (this.deps.run.practice && this.deps.run.active) return;
    if (
      this.owner &&
      !this.deps.run.active &&
      this.deps.accounts.sync.ready &&
      this.status !== 'loading' &&
      Date.now() - this.lastRefresh > 15000
    ) {
      await this.refresh();
      return;
    }
    if (
      !this.owner ||
      !this.deps.run.active ||
      this.deps.run.over ||
      !this.summary ||
      this.summary.runId !== this.deps.run.id ||
      this.status === 'loading'
    )
      return;
    if (Date.now() >= this.leaseDeadline && this.status !== 'offline') {
      this.deps.game.setPause('checkpoint', true);
      this.deps.input.setActive(false);
      this.error = 'No se pudo verificar la sesión. La incursión está detenida; reintentá con conexión.';
      this.status = 'offline';
      this.notify();
      this.onNotice?.();
    }
    if (Date.now() - this.lastHeartbeat < 8000) return;
    this.lastHeartbeat = Date.now();
    await this.enqueue(async (epoch) => {
      await this.recoverOperation(epoch);
      if (!this.summary) return;
      const cmd = this.command('heartbeat');
      cmd.runId = this.summary.runId;
      cmd.revision = this.summary.revision;
      const reply = await this.remote(cmd, epoch);
      this.summary = reply.save;
      this.leaseDeadline = Date.now() + 25000;
      this.error = '';
      this.notify();
    });
  }
  private command(action: CheckpointCommand['action']): CheckpointCommand {
    return { action, clientId: this.clientId, operationId: createId() };
  }
  private async recoverOperation(epoch: number): Promise<void> {
    const command = this.record.operation;
    if (!command) return;
    const reply = await this.remote(command, epoch);
    this.confirm(reply, command.payload, command.clientId);
  }
  private async remote(request: CheckpointCommand, epoch: number): Promise<CheckpointReply> {
    const owner = this.owner,
      client = this.deps.accounts.client;
    if (!owner || !client || epoch !== this.epoch) throw new Error('La cuenta cambió durante el guardado.');
    const result = await this.deps.accounts.sync.withServerProfile(async () => {
      const reply = await checkpointRpc(client, owner, request);
      return { profile: reply.profile, value: reply };
    });
    if (epoch !== this.epoch) throw new Error('La cuenta cambió durante el guardado.');
    return result;
  }
  private confirm(reply: CheckpointReply, snapshot?: RunSnapshot, expectedClient = this.clientId): void {
    this.summary = reply.save;
    this.known = true;
    if (!reply.save) {
      this.record = empty();
      this.leaseDeadline = 0;
    } else {
      if (reply.save.clientId !== expectedClient)
        throw new CheckpointError('La incursión ya está en otra sesión.', 'lost');
      const payload = reply.save.payload ?? snapshot;
      if (payload) this.record.confirmed = payload;
      if (payload && this.record.pending?.run.reportSeq === payload.run.reportSeq) this.record.pending = null;
      this.record.revision = reply.save.revision;
      this.record.clientId = expectedClient;
      this.record.operation = null;
      this.record.terminal = null;
      this.leaseDeadline = expectedClient === this.clientId ? Date.now() + 25000 : 0;
    }
    this.status = 'saved';
    this.error = '';
    this.persist();
  }
  private enqueue(action: (epoch: number) => Promise<void>, failed?: () => void): Promise<void> {
    const epoch = this.epoch;
    const next = this.chain.then(async () => {
      if (epoch !== this.epoch) return;
      try {
        await action(epoch);
      } catch (error) {
        if (epoch !== this.epoch) return;
        this.fail(error);
        failed?.();
      }
    });
    this.chain = next;
    return next;
  }
  private fail(error: unknown): void {
    this.error = error instanceof Error ? error.message : 'No se pudo guardar la incursión.';
    const code = error instanceof CheckpointError ? error.code : 'network';
    this.status =
      code === 'busy'
        ? 'busy'
        : code === 'changed'
          ? 'conflict'
          : code === 'lost'
            ? 'lost'
            : code === 'network'
              ? 'offline'
              : 'error';
    if ((code === 'lost' || code === 'changed') && this.deps.run.active) {
      this.deps.input.setActive(false);
      this.deps.game.setPause('checkpoint', true);
      this.deps.run.suspendToMenu();
      this.deps.game.setPause('checkpoint', false);
      this.onNotice?.();
    }
    this.notify();
  }
  private unlock(): void {
    this.deps.game.setPause('checkpoint', false);
    this.deps.input.releaseAll();
    this.deps.input.setActive(!this.deps.isMenuOpen());
  }
  private persist(): void {
    if (!writeJson(key(this.owner), this.record, this.storage)) {
      this.error = 'No se pudo guardar la copia local. Mantené la página abierta hasta que el servidor confirme.';
      this.notify();
    }
  }
  private readLocal(): void {
    const raw = readJson(key(this.owner), this.storage) as LocalCheckpoint | null;
    this.record = raw && typeof raw.revision === 'number' ? raw : empty();
  }
  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
