/*
 * Global pointer "probe": a small gapped crosshair with a live X/Y readout in
 * mono that follows the mouse. Fine pointers only; the element is created
 * here, aria-hidden and pointer-events: none.
 */
import { pad } from './common';

export function mountCursorField(): () => void {
  const mq = matchMedia('(pointer: fine)');
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2147483000;opacity:0;' +
    'transition:opacity .25s;color:var(--c-signal,#FF7A2F);font:500 10px/1 var(--f-mono,ui-monospace,monospace);' +
    'will-change:transform;contain:layout style';
  const bar = (css: string): void => {
    const b = document.createElement('i');
    b.style.cssText = `position:absolute;background:currentColor;${css}`;
    el.appendChild(b);
  };
  bar('left:-14px;top:0;width:9px;height:1px');
  bar('left:6px;top:0;width:9px;height:1px');
  bar('left:0;top:-14px;width:1px;height:9px');
  bar('left:0;top:6px;width:1px;height:9px');
  const ro = document.createElement('span');
  ro.style.cssText =
    'position:absolute;left:12px;top:10px;white-space:nowrap;letter-spacing:.04em;color:var(--c-ink,#E8EBEE);opacity:.7';
  el.appendChild(ro);
  document.body.appendChild(el);

  let x = 0, y = 0, raf = 0, shown = false;
  const show = (v: boolean): void => {
    if (v !== shown) {
      shown = v;
      el.style.opacity = v ? '1' : '0';
    }
  };
  const paint = (): void => {
    raf = 0;
    el.style.transform = `translate3d(${x}px,${y}px,0)`;
    ro.textContent = `X ${pad(x, 4)}  Y ${pad(y, 4)}`;
  };
  const onMove = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' || !mq.matches) return show(false);
    x = e.clientX;
    y = e.clientY;
    show(true);
    if (!raf) raf = requestAnimationFrame(paint);
  };
  const onOut = (e: PointerEvent): void => {
    if (!e.relatedTarget) show(false);
  };
  const onMq = (): void => {
    if (!mq.matches) show(false);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerout', onOut, { passive: true });
  mq.addEventListener('change', onMq);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerout', onOut);
    mq.removeEventListener('change', onMq);
    el.remove();
  };
}
