/**
 * The two native controls the canvas cannot replace: a text field for the name and a select for
 * the nationality. They float over the canvas only on the customisation screen.
 */
export interface Overlay {
  input: HTMLInputElement;
  select: HTMLSelectElement;
  /** Place both controls (CSS pixels) or hide them when `visible` is false. */
  place(visible: boolean, input: Rect, select: Rect): void;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BASE_STYLE =
  'position:absolute;box-sizing:border-box;border:2px solid #ffc531;border-radius:12px;background:#1b1d2a;color:#fff;' +
  'font:600 15px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:0 12px;outline:none;display:none;';

export function createOverlay(host: HTMLElement, maxLength: number, countries: readonly (readonly [string, string])[], noneLabel: string): Overlay {
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = maxLength;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.style.cssText = BASE_STYLE;

  const select = document.createElement('select');
  select.style.cssText = BASE_STYLE;
  const none = document.createElement('option');
  none.value = '';
  none.textContent = noneLabel;
  select.appendChild(none);
  for (const [code, name] of countries) {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = name;
    select.appendChild(o);
  }
  host.appendChild(input);
  host.appendChild(select);

  const apply = (el: HTMLElement, r: Rect, visible: boolean): void => {
    el.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    el.style.left = `${r.x}px`;
    el.style.top = `${r.y}px`;
    el.style.width = `${r.w}px`;
    el.style.height = `${r.h}px`;
  };

  return {
    input,
    select,
    place(visible, i, s) {
      apply(input, i, visible);
      apply(select, s, visible);
    },
  };
}
