/**
 * Bounded undo/redo stack with optional time-window coalescing for smooth drags & sliders.
 */
export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
  lastPushAt: number;
}

export function createHistory<T>(initial: T): HistoryState<T> {
  return { past: [], present: initial, future: [], lastPushAt: 0 };
}

export function pushHistory<T>(
  state: HistoryState<T>,
  next: T,
  options: { now?: number; coalesceMs?: number; limit?: number } = {},
): HistoryState<T> {
  if (Object.is(state.present, next)) return state;
  const now = options.now ?? Date.now();
  const coalesceMs = options.coalesceMs ?? 0;
  const limit = options.limit ?? 60;

  if (coalesceMs > 0 && state.past.length > 0 && now - state.lastPushAt <= coalesceMs) {
    return {
      past: state.past,
      present: next,
      future: [],
      lastPushAt: now,
    };
  }

  const past = [...state.past, state.present];
  if (past.length > limit) past.splice(0, past.length - limit);
  return {
    past,
    present: next,
    future: [],
    lastPushAt: now,
  };
}

export function undoHistory<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.past.length === 0) return state;
  const prev = state.past[state.past.length - 1];
  return {
    past: state.past.slice(0, -1),
    present: prev,
    future: [state.present, ...state.future],
    lastPushAt: 0,
  };
}

export function redoHistory<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.future.length === 0) return state;
  const [next, ...rest] = state.future;
  return {
    past: [...state.past, state.present],
    present: next,
    future: rest,
    lastPushAt: 0,
  };
}

export function resetHistory<T>(value: T): HistoryState<T> {
  return createHistory(value);
}

