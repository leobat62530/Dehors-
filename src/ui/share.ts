/** Share hook: Telegram plugs its own handler in; outside Telegram the Web Share API, then the clipboard. */
export type ShareHandler = (text: string) => Promise<boolean> | boolean;

let handler: ShareHandler | null = null;

export function setShareHandler(h: ShareHandler | null): void {
  handler = h;
}

export async function shareText(text: string): Promise<boolean> {
  if (handler) return handler(text);
  if (typeof navigator === 'undefined') return false;
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ text });
      return true;
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Cancelled or refused: nothing to do.
  }
  return false;
}
