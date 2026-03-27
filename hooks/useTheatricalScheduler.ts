"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ScheduledEvent<T = unknown> {
  type: string;
  data: T;
  streamText?: string;
}

interface TheatricalSchedulerCallbacks<TEvent extends ScheduledEvent = ScheduledEvent> {
  onEventRelease?: (event: TEvent) => void;
  onTextStreamChunk?: (event: TEvent, text: string) => void;
  onTextStreamComplete?: (event: TEvent, text: string) => void;
  onComplete?: () => void;
}

export interface UseTheatricalSchedulerOptions<TEvent extends ScheduledEvent = ScheduledEvent>
  extends TheatricalSchedulerCallbacks<TEvent> {
  defaultIntervalMs?: number;
  intervalOverrides?: Record<string, number>;
}

interface SchedulerSnapshot {
  isReplaying: boolean;
  remaining: number;
}

interface RuntimeSchedulerOptions<TEvent extends ScheduledEvent = ScheduledEvent>
  extends UseTheatricalSchedulerOptions<TEvent> {
  onStateChange?: (snapshot: SchedulerSnapshot) => void;
}

export interface TheatricalSchedulerController<TEvent extends ScheduledEvent = ScheduledEvent> {
  enqueue: (events: TEvent[]) => void;
  flush: () => void;
  cancel: () => void;
  dispose: () => void;
  updateOptions: (nextOptions: RuntimeSchedulerOptions<TEvent>) => void;
  getSnapshot: () => SchedulerSnapshot;
}

export const DEFAULT_THEATRICAL_INTERVAL_MS = 900;

export const DEFAULT_THEATRICAL_INTERVAL_OVERRIDES: Record<string, number> = {
  encoding_start: 700,
  episode_created: 1800,
  pattern_detected: 3500,
  rule_promoted: 4500,
  contradiction_found: 2500,
  salience_updated: 1800,
  consolidation_start: 1200,
  consolidation_complete: 500,
};

const STREAM_TEXT_CHUNK_SIZE = 20;
const STREAM_TEXT_INTERVAL_MS = 50;

function coerceInterval(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}

export function createTheatricalSchedulerController<TEvent extends ScheduledEvent = ScheduledEvent>(
  initialOptions: RuntimeSchedulerOptions<TEvent> = {},
): TheatricalSchedulerController<TEvent> {
  let options = initialOptions;
  let queue: TEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let streamTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingEvent: TEvent | null = null;
  let activeStreamEvent: TEvent | null = null;
  let streamCursor = 0;
  let isReplaying = false;
  let remaining = 0;

  const notifyState = () => {
    options.onStateChange?.({ isReplaying, remaining });
  };

  const clearTimers = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    if (streamTimer) {
      clearTimeout(streamTimer);
      streamTimer = null;
    }
  };

  const finishReplay = (shouldComplete: boolean) => {
    clearTimers();
    queue = [];
    pendingEvent = null;
    activeStreamEvent = null;
    streamCursor = 0;
    isReplaying = false;
    remaining = 0;
    notifyState();

    if (shouldComplete) {
      options.onComplete?.();
    }
  };

  const getEventDelay = (event: TEvent) => {
    const intervalOverrides = options.intervalOverrides ?? DEFAULT_THEATRICAL_INTERVAL_OVERRIDES;
    const defaultInterval = coerceInterval(options.defaultIntervalMs, DEFAULT_THEATRICAL_INTERVAL_MS);
    return coerceInterval(intervalOverrides[event.type], defaultInterval);
  };

  const playStreamText = (event: TEvent, onDone: () => void) => {
    const streamText = event.streamText ?? "";
    activeStreamEvent = event;

    if (streamText.length === 0) {
      options.onTextStreamComplete?.(event, "");
      activeStreamEvent = null;
      streamCursor = 0;
      onDone();
      return;
    }

    streamCursor = 0;

    const tick = () => {
      if (!isReplaying || activeStreamEvent !== event) {
        return;
      }

      const nextCursor = Math.min(streamText.length, streamCursor + STREAM_TEXT_CHUNK_SIZE);
      streamCursor = nextCursor;

      const accumulated = streamText.slice(0, nextCursor);
      options.onTextStreamChunk?.(event, accumulated);

      if (nextCursor >= streamText.length) {
        streamTimer = null;
        options.onTextStreamComplete?.(event, accumulated);
        activeStreamEvent = null;
        streamCursor = 0;
        onDone();
        return;
      }

      streamTimer = setTimeout(tick, STREAM_TEXT_INTERVAL_MS);
    };

    tick();
  };

  const releaseNext = () => {
    if (!isReplaying) {
      return;
    }

    const nextEvent = queue.shift() ?? null;

    if (!nextEvent) {
      finishReplay(true);
      return;
    }

    pendingEvent = nextEvent;
    remaining = queue.length;
    notifyState();

    const handleRelease = () => {
      if (!isReplaying) {
        return;
      }

      pendingEvent = null;
      options.onEventRelease?.(nextEvent);

      if (typeof nextEvent.streamText === "string") {
        playStreamText(nextEvent, releaseNext);
        return;
      }

      releaseNext();
    };

    timer = setTimeout(handleRelease, getEventDelay(nextEvent));
  };

  const cancel = () => {
    clearTimers();
    queue = [];
    pendingEvent = null;
    activeStreamEvent = null;
    streamCursor = 0;
    isReplaying = false;
    remaining = 0;
    notifyState();
  };

  const flush = () => {
    if (!isReplaying) {
      return;
    }

    clearTimers();

    if (activeStreamEvent && typeof activeStreamEvent.streamText === "string") {
      const fullText = activeStreamEvent.streamText;
      options.onTextStreamChunk?.(activeStreamEvent, fullText);
      options.onTextStreamComplete?.(activeStreamEvent, fullText);
      activeStreamEvent = null;
      streamCursor = 0;
    }

    if (pendingEvent) {
      const event = pendingEvent;
      pendingEvent = null;
      options.onEventRelease?.(event);
      if (typeof event.streamText === "string") {
        options.onTextStreamChunk?.(event, event.streamText);
        options.onTextStreamComplete?.(event, event.streamText);
      }
    }

    while (queue.length > 0) {
      const event = queue.shift()!;
      options.onEventRelease?.(event);
      if (typeof event.streamText === "string") {
        options.onTextStreamChunk?.(event, event.streamText);
        options.onTextStreamComplete?.(event, event.streamText);
      }
    }

    finishReplay(true);
  };

  const enqueue = (events: TEvent[]) => {
    cancel();

    if (!Array.isArray(events) || events.length === 0) {
      return;
    }

    queue = [...events];
    isReplaying = true;
    remaining = events.length;
    notifyState();
    releaseNext();
  };

  return {
    enqueue,
    flush,
    cancel,
    dispose: cancel,
    updateOptions: (nextOptions: RuntimeSchedulerOptions<TEvent>) => {
      options = nextOptions;
    },
    getSnapshot: () => ({ isReplaying, remaining }),
  };
}

export function useTheatricalScheduler<TEvent extends ScheduledEvent = ScheduledEvent>(
  options: UseTheatricalSchedulerOptions<TEvent> = {},
) {
  const [snapshot, setSnapshot] = useState<SchedulerSnapshot>({ isReplaying: false, remaining: 0 });
  const controllerRef = useRef<TheatricalSchedulerController<TEvent> | null>(null);

  if (controllerRef.current == null) {
    controllerRef.current = createTheatricalSchedulerController<TEvent>({
      ...options,
      onStateChange: setSnapshot,
    });
  }

  useEffect(() => {
    controllerRef.current?.updateOptions({
      ...options,
      onStateChange: setSnapshot,
    });
  }, [options]);

  useEffect(() => {
    return () => {
      controllerRef.current?.dispose();
    };
  }, []);

  const enqueue = useCallback((events: TEvent[]) => {
    controllerRef.current?.enqueue(events);
  }, []);

  const flush = useCallback(() => {
    controllerRef.current?.flush();
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.cancel();
  }, []);

  return useMemo(
    () => ({
      enqueue,
      isReplaying: snapshot.isReplaying,
      remaining: snapshot.remaining,
      flush,
      cancel,
    }),
    [cancel, enqueue, flush, snapshot.isReplaying, snapshot.remaining],
  );
}
