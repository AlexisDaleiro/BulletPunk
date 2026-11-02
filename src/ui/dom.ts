/** Builds an element with a class and children; strings become text nodes. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

export function button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
  const b = el('button', `btn ${className}`.trim(), label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

const CONFIRM_WINDOW_MS = 3000;

/** Two-press button for destructive actions: the first press asks, the second does it; it disarms itself after a moment. */
export function confirmButton(label: string, confirmLabel: string, onConfirm: () => void, className = ''): HTMLButtonElement {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const disarm = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    b.classList.remove('armed');
    b.textContent = label;
  };
  const b = button(
    label,
    () => {
      if (timer === null) {
        b.classList.add('armed');
        b.textContent = confirmLabel;
        timer = setTimeout(disarm, CONFIRM_WINDOW_MS);
      } else {
        disarm();
        onConfirm();
      }
    },
    className,
  );
  b.addEventListener('blur', disarm);
  return b;
}

/** Copies `getText()` to the clipboard and says so on the button for a moment. */
export function copyButton(label: string, getText: () => string): HTMLButtonElement {
  const b = button(label, () => {
    const say = (text: string): void => {
      b.textContent = text;
      setTimeout(() => (b.textContent = label), 1500);
    };
    const write = navigator.clipboard?.writeText(getText());
    if (write) write.then(() => say('COPIED'), () => say('COPY FAILED'));
    else say('COPY FAILED');
  });
  return b;
}

/** An ON/OFF button. `set` updates it from outside without firing `onChange`. */
export function toggle(onChange: (on: boolean) => void): { el: HTMLButtonElement; set(on: boolean): void } {
  const set = (on: boolean): void => {
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? 'ON' : 'OFF';
  };
  const b = button('OFF', () => onChange(b.getAttribute('aria-pressed') !== 'true'), 'toggle');
  set(false);
  return { el: b, set };
}

/** A label on the left, controls on the right. */
export function row(label: string, ...controls: Node[]): HTMLDivElement {
  return el('div', 'row', el('span', 'name', label), ...controls);
}
