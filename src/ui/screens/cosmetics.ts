import { getCharacter } from '../../characters/characters';
import { WEAPONS } from '../../combat/weapons';
import { COSMETICS, unlockText, type CosmeticKind } from '../../profile/cosmetics';
import { button, el } from '../dom';
import { operativeSplash } from '../splash';
import type { UiContext } from '../UI';
import { weaponSwatch } from '../weaponSwatch';
import { syncLabel } from '../syncLabel';

export function cosmeticsScreen(ctx: UiContext): HTMLElement {
  const def = getCharacter(ctx.profile.value.lastCharacter);
  const look = ctx.profile.lookFor(def.id);
  let category: CosmeticKind = 'skin';
  const stage = el('div', 'cosmetic-stage');
  const options = el('div', 'cosmetic-options');
  const message = el('p', 'cosmetic-message'); message.setAttribute('aria-live', 'polite');
  const tabs = el('div', 'cosmetic-tabs');
  const tabButtons = new Map<CosmeticKind, HTMLButtonElement>();
  const equip = button('EQUIPAR ESTILO', () => {
    if (Object.values(look).some(id => !ctx.profile.value.cosmetics.unlocked.includes(id))) return;
    for (const kind of ['skin', 'weapon', 'frame', 'pose'] as const) ctx.profile.equip(def.id, kind, look[kind]);
    message.textContent = ctx.accounts.isGuest ? 'ESTILO GUARDADO EN ESTE DISPOSITIVO · Se aplica al próximo despliegue.' : 'ESTILO ACTUALIZADO · Se aplica al próximo despliegue. Revisá el estado de sincronización.';
  }, 'primary');
  const refresh = (): void => {
    for (const [kind, tab] of tabButtons) tab.setAttribute('aria-pressed', String(kind === category));
    stage.dataset.frame = look.frame;
    stage.replaceChildren(operativeSplash(def, 'cosmetic-splash', false, look),
      el('div', 'cosmetic-stage-label', el('span', 'roster-kicker', def.role), el('strong', '', def.name),
        el('span', '', COSMETICS.find(c => c.id === look.pose)?.name ?? ''),
        el('div', 'finish-preview', weaponSwatch(WEAPONS[def.weapon], look.weapon), el('span', '', `${WEAPONS[def.weapon].name} / ${COSMETICS.find(c => c.id === look.weapon)?.name}`))),
    );
    stage.dataset.finish = look.weapon;
    options.replaceChildren(...COSMETICS.filter(item => item.kind === category).map(item => {
      const unlocked = ctx.profile.value.cosmetics.unlocked.includes(item.id);
      const choice = button('', () => {
        look[category] = item.id;
        message.textContent = unlocked ? 'Vista previa. Equipa el estilo para guardarlo.' : `VISTA PREVIA BLOQUEADA · ${unlockText(item)}`;
        refresh();
      }, 'cosmetic-option');
      choice.dataset.cosmetic = item.id;
      choice.setAttribute('aria-pressed', String(look[category] === item.id));
      choice.setAttribute('aria-label', `${item.name}${unlocked ? '' : ', bloqueado'}`);
      choice.append(el('span', 'cosmetic-lock', unlocked ? 'DESBLOQUEADO' : '◇ BLOQUEADO'), el('strong', '', item.name), el('p', '', item.description), el('small', '', unlockText(item)));
      return choice;
    }));
    equip.disabled = Object.values(look).some(id => !ctx.profile.value.cosmetics.unlocked.includes(id));
  };
  for (const [kind, name] of [['skin', 'APARIENCIA'], ['weapon', 'ARMA'], ['frame', 'MARCO'], ['pose', 'POSE']] as const) {
    const tab = button(name, () => { category = kind; refresh(); }, 'cosmetic-tab');
    tabButtons.set(kind, tab); tabs.append(tab);
  }
  refresh();
  const sync = el('p', 'account-sync-state', syncLabel(ctx.accounts));
  ctx.cleanup(ctx.accounts.subscribe(() => { sync.textContent = syncLabel(ctx.accounts); }));
  return el('div', 'panel cosmetic-panel', el('span', 'roster-kicker', 'ARCHIVO DEL OPERATIVO / PERSONALIZACIÓN'),
    el('h2', 'roster-title', 'Tu firma en la ciudad'),
    el('p', 'evolution-intro', 'Los logros de tus incursiones desbloquean estilos. Todos los cosméticos conservan las estadísticas del equipo.'),
    el('div', 'cosmetic-layout', stage, el('div', 'cosmetic-catalog', tabs, options, message)),
    el('div', 'roster-footer', button('← VOLVER', ctx.back), equip), sync,
  );
}
