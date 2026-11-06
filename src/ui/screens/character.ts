import { CHARACTERS, getCharacter } from '../../characters/characters';
import { WEAPONS } from '../../combat/weapons';
import { button, el } from '../dom';
import { cinematicBackdrop, operativeSplash } from '../splash';
import type { UiContext } from '../UI';

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

export function characterScreen(ctx: UiContext): HTMLElement {
  const { profile } = ctx;
  const cards = el('div', 'cards');
  const briefing = el('aside', 'operative-briefing');
  briefing.setAttribute('aria-live', 'polite');
  const buttons = new Map<string, HTMLButtonElement>();
  let replacementArmed=false;
  const deploy = button('', () => {
    if(ctx.saves.hasSaved&&!ctx.run.active&&!replacementArmed){replacementArmed=true;deploy.textContent='DESCARTAR GUARDADO Y DESPLEGAR';deploy.classList.add('armed');return;}
    ctx.close();
    ctx.startNew(getCharacter(profile.value.lastCharacter).id, ctx.takeSeed(),replacementArmed);
  }, 'primary deploy-action');
  const selected = el('span', 'selection-label');
  deploy.disabled = !ctx.accounts.canPlay||['loading','saving'].includes(ctx.saves.status);
  ctx.cleanup(ctx.accounts.subscribe(() => { deploy.disabled = !ctx.accounts.canPlay||['loading','saving'].includes(ctx.saves.status); }));
  ctx.cleanup(ctx.saves.subscribe(()=>{deploy.disabled=!ctx.accounts.canPlay||ctx.saves.status==='loading'||ctx.saves.status==='saving';}));

  const refresh = (): void => {
    replacementArmed=false;deploy.classList.remove('armed');
    const def = getCharacter(profile.value.lastCharacter);
    for (const [id, b] of buttons) b.setAttribute('aria-pressed', String(id === def.id));
    deploy.textContent = `DESPLEGAR A ${def.name} ↗`;
    selected.textContent = `${def.name} / LISTO PARA DESPLIEGUE`;
    briefing.style.setProperty('--c', hex(def.color));
    briefing.dataset.frame = profile.lookFor(def.id).frame;
    briefing.replaceChildren(
      operativeSplash(def, 'briefing-splash', false, profile.lookFor(def.id)), el('div', 'briefing-shade'),
      el('div', 'briefing-content',
        el('span', 'card-role', `OPERATIVO / ${def.role}`), el('strong', 'briefing-name', def.name),
        el('p', 'briefing-description', def.description),
        el('div', 'dossier-stats',
          el('span', '', el('b', '', String(def.hp)), 'VIDA'),
          el('span', '', el('b', '', String(def.shield)), 'ESCUDO'),
          el('span', '', el('b', '', `${Math.round(def.moveSpeed * 100)}%`), 'VELOCIDAD'),
        ),
        el('span', 'briefing-weapon', WEAPONS[def.weapon].name),
        el('strong', 'card-ability', def.ability.name),
        el('p', 'ability-description', def.ability.description),
        el('span', 'card-timing', `${def.ability.duration} s activa / ${def.ability.cooldown} s recarga`),
        el('p', 'briefing-passive', `${def.passive.name}: ${def.passive.description}`),
        el('span', 'card-weakness', def.weakness),
      ),
    );
  };

  for (const [index, def] of CHARACTERS.entries()) {
    const card = el('button', 'card', operativeSplash(def, 'card-splash', true, profile.lookFor(def.id)),
      el('span', 'card-number', `0${index + 1}`), el('span', 'card-selection', '↗'),
      el('div', 'card-caption', el('span', 'card-role', def.role), el('strong', 'card-name', def.name)),
    );
    card.type = 'button';
    card.dataset.frame = profile.lookFor(def.id).frame;
    card.style.setProperty('--c', hex(def.color));
    card.setAttribute('aria-label', `${def.name}, ${def.role.toLowerCase()}`);
    card.addEventListener('click', () => { profile.setLastCharacter(def.id); refresh(); });
    buttons.set(def.id, card);
    cards.append(card);
  }
  refresh();
  buttons.get(getCharacter(profile.value.lastCharacter).id)?.setAttribute('data-autofocus', '');

  return el('div', 'panel operative-select', cinematicBackdrop(),
    el('div', 'roster-header',
      el('div', '', el('span', 'roster-kicker', 'EL EQUIPO / PROTOCOLO ZERO'), el('h2', 'roster-title', 'Elige tu operativo')),
      el('p', 'roster-subtitle', 'Seis formas de entrar. Una salida.'),
    ),
    el('div', 'roster-shell', briefing, el('section', 'roster-grid', el('span', 'roster-grid-label', 'SELECCIONA TU ESTILO DE COMBATE'), cards)),
    el('div', 'roster-footer', button('← VOLVER', ctx.back), button('PERSONALIZAR', () => ctx.go('cosmetics')), selected, deploy),
    el('p', 'roster-controls', window.matchMedia('(pointer: coarse)').matches
      ? 'PAD IZQUIERDO mover · PAD DERECHO apuntar · CONO ROJO disparo automático'
      : 'WASD mover · Ratón apuntar · F habilidad · Espacio dash · Q cambiar arma'),
  );
}
