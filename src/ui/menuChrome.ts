import { el } from './dom';

const PATHS = {
  play: ['M9 5 20 12 9 19Z'],
  arrow: ['M5 12h14', 'm13 6 6 6-6 6'],
  operatives: ['M15 19v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M17 4a4 4 0 0 1 0 7', 'M21 19v-2a4 4 0 0 0-3-4'],
  profile: ['M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7Z', 'm8 12 3 3 5-6'],
  settings: ['M4 7h16', 'M4 17h16', 'M9 4v6', 'M15 14v6'],
} as const;

export function menuIcon(name: keyof typeof PATHS): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'menu-icon');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of PATHS[name]) {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

export function menuBrand(): HTMLElement {
  return el('div', 'menu-brand', el('span', 'brand-monogram', 'BP'),
    el('span', '', el('strong', '', 'BULLET', el('b', '', 'PUNK')), el('small', '', 'PROTOCOL ZERO')));
}

export function metric(label: string, value: string | number): HTMLElement {
  return el('div', 'menu-metric', el('strong', '', String(value)), el('span', '', label));
}
