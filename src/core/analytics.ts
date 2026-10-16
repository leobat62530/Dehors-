/**
 * Anonymous events: what happens in a session, never who the player is. They queue in memory and
 * leave through a sink the Telegram/Supabase layer plugs in; without a sink they are dropped.
 */
export interface AnalyticsEvent {
  name: string;
  at: number;
  props: Record<string, number | string | boolean>;
}

export type AnalyticsSink = (events: AnalyticsEvent[]) => void;

const queue: AnalyticsEvent[] = [];
const MAX_QUEUE = 64;
let sink: AnalyticsSink | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export function setAnalyticsSink(s: AnalyticsSink | null): void {
  sink = s;
  if (s && queue.length > 0) flush();
}

export function track(name: string, props: Record<string, number | string | boolean> = {}): void {
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push({ name, at: Date.now(), props });
  if (sink && timer === null) timer = setTimeout(flush, 2000);
}

export function flush(): void {
  timer = null;
  if (!sink || queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    sink(batch);
  } catch {
    // The sink is best effort; a failed batch is lost, never retried into a loop.
  }
}

/** Queued events, for tests and the debug overlay. */
export function pending(): readonly AnalyticsEvent[] {
  return queue;
}
