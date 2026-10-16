/**
 * Single-pointer input in CSS pixels. Keeps the latest state in fields the game reads each step,
 * so no event objects are kept around.
 */
export interface PointerListener {
  down(x: number, y: number): void;
  move(x: number, y: number): void;
  up(x: number, y: number): void;
}

export function attachPointer(target: HTMLElement, listener: PointerListener): void {
  let activeId: number | null = null;
  target.addEventListener('pointerdown', (e) => {
    if (activeId !== null) return;
    activeId = e.pointerId;
    target.setPointerCapture(e.pointerId);
    listener.down(e.clientX, e.clientY);
    e.preventDefault();
  });
  target.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeId) return;
    listener.move(e.clientX, e.clientY);
  });
  const finish = (e: PointerEvent): void => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    listener.up(e.clientX, e.clientY);
  };
  target.addEventListener('pointerup', finish);
  target.addEventListener('pointercancel', finish);
}
