const portrait = window.matchMedia('(pointer: coarse) and (orientation: portrait)');

/**
 * Landscape-only play on touch devices. Reports portrait changes (the page shows a rotate prompt, the
 * caller pauses), and on the first tap tries fullscreen + orientation lock, which Android Chrome allows.
 * iOS supports neither, so the prompt is the fallback there.
 */
export function initLandscape(onPortrait: (portrait: boolean) => void): void {
  onPortrait(portrait.matches);
  portrait.addEventListener('change', (e) => onPortrait(e.matches));

  const enter = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') return;
    window.removeEventListener('pointerup', enter);
    const lock = (screen.orientation as { lock?: (o: string) => Promise<void> }).lock;
    document.documentElement
      .requestFullscreen({ navigationUI: 'hide' })
      .then(() => lock?.call(screen.orientation, 'landscape'))
      .catch(() => {});
  };
  window.addEventListener('pointerup', enter);
}
