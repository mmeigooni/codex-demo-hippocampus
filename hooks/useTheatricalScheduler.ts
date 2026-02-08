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

export const DEFAULT_THEATRICAL_INTERVAL_MS = 450;

export const DEFAULT_THEATRICAL_INTERVAL_OVERRIDES: Record<string, number> = {
  encoding_start: 150,
  episode_created: 550,
  pattern_detected: 700,
  rule_promoted: 900,
  contradiction_found: 600,
  salience_updated: 350,
  consolidation_start: 400,
  consolidation_complete: 200,
};

const STREAM_TEXT_CHUNK_SIZE = 40;
const STREAM_TEXT_INTERVAL_MS = 35;

interface InternalState<TEvent extends ScheduledEvent> {
  active: boolean;
  queue: TEvent[];
  activeStreamEvent: TEvent | null;
}

function coerceInterval(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}

export function useTheatricalScheduler<TEvent extends ScheduledEvent = ScheduledEvent>(
  options: UseTheatricalSchedulerOptions<TEvent> = {},
) {
  const optionsRef = useRef<UseTheatricalSchedulerOptions<TEvent>>(options);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamCursorRef = useRef(0);
  const stateRef = useRef<InternalState<TEvent>>({
    active: false,
    queue: [],
    activeStreamEvent: null,
  });

  const [isReplaying, setIsReplaying] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }, []);

  const finishReplay = useCallback(
    (shouldComplete: boolean) => {
      clearTimers();
      stateRef.current.active = false;
      stateRef.current.queue = [];
      stateRef.current.activeStreamEvent = null;
      streamCursorRef.current = 0;
      setIsReplaying(false);
      setRemaining(0);

      if (shouldComplete) {
        optionsRef.current.onComplete?.();
      }
    },
    [clearTimers],
  );

  const getEventDelay = useCallback((event: TEvent) => {
    const intervalOverrides = optionsRef.current.intervalOverrides ?? DEFAULT_THEATRICAL_INTERVAL_OVERRIDES;
    const defaultInterval = coerceInterval(optionsRef.current.defaultIntervalMs, DEFAULT_THEATRICAL_INTERVAL_MS);
    return coerceInterval(intervalOverrides[event.type], defaultInterval);
  }, []);

  const playStreamText = useCallback(
    (event: TEvent, onDone: () => void) => {
      const streamText = event.streamText ?? "";
      stateRef.current.activeStreamEvent = event;

      if (streamText.length === 0) {
        optionsRef.current.onTextStreamComplete?.(event, "");
        stateRef.current.activeStreamEvent = null;
        streamCursorRef.current = 0;
        onDone();
        return;
      }

      streamCursorRef.current = 0;

      const tick = () => {
        if (!stateRef.current.active || stateRef.current.activeStreamEvent !== event) {
          return;
        }

        const nextCursor = Math.min(streamText.length, streamCursorRef.current + STREAM_TEXT_CHUNK_SIZE);
        streamCursorRef.current = nextCursor;

        const accumulated = streamText.slice(0, nextCursor);
        optionsRef.current.onTextStreamChunk?.(event, accumulated);

        if (nextCursor >= streamText.length) {
          streamTimerRef.current = null;
          optionsRef.current.onTextStreamComplete?.(event, accumulated);
          stateRef.current.activeStreamEvent = null;
          streamCursorRef.current = 0;
          onDone();
          return;
        }

        streamTimerRef.current = setTimeout(tick, STREAM_TEXT_INTERVAL_MS);
      };

      tick();
    },
    [],
  );

  const releaseNext = useCallback(() => {
    if (!stateRef.current.active) {
      return;
    }

    const nextEvent = stateRef.current.queue.shift() ?? null;

    if (!nextEvent) {
      finishReplay(true);
      return;
    }

    setRemaining(stateRef.current.queue.length);

    const handleRelease = () => {
      if (!stateRef.current.active) {
        return;
      }

      optionsRef.current.onEventRelease?.(nextEvent);

      if (typeof nextEvent.streamText === "string") {
        playStreamText(nextEvent, releaseNext);
        return;
      }

      releaseNext();
    };

    timerRef.current = setTimeout(handleRelease, getEventDelay(nextEvent));
  }, [finishReplay, getEventDelay, playStreamText]);

  const cancel = useCallback(() => {
    clearTimers();
    stateRef.current.active = false;
    stateRef.current.queue = [];
    stateRef.current.activeStreamEvent = null;
    streamCursorRef.current = 0;
    setIsReplaying(false);
    setRemaining(0);
  }, [clearTimers]);

  const flush = useCallback(() => {
    if (!stateRef.current.active) {
      return;
    }

    clearTimers();

    const activeStreamEvent = stateRef.current.activeStreamEvent;
    if (activeStreamEvent && typeof activeStreamEvent.streamText === "string") {
      const fullText = activeStreamEvent.streamText;
      optionsRef.current.onTextStreamChunk?.(activeStreamEvent, fullText);
      optionsRef.current.onTextStreamComplete?.(activeStreamEvent, fullText);
      stateRef.current.activeStreamEvent = null;
      streamCursorRef.current = 0;
    }

    while (stateRef.current.queue.length > 0) {
      const event = stateRef.current.queue.shift()!;
      optionsRef.current.onEventRelease?.(event);
      if (typeof event.streamText === "string") {
        optionsRef.current.onTextStreamChunk?.(event, event.streamText);
        optionsRef.current.onTextStreamComplete?.(event, event.streamText);
      }
    }

    finishReplay(true);
  }, [clearTimers, finishReplay]);

  const enqueue = useCallback(
    (events: TEvent[]) => {
      cancel();

      if (!Array.isArray(events) || events.length === 0) {
        return;
      }

      stateRef.current.active = true;
      stateRef.current.queue = [...events];
      setIsReplaying(true);
      setRemaining(events.length);
      releaseNext();
    },
    [cancel, releaseNext],
  );

  useEffect(() => {
    return () => {
      clearTimers();
      stateRef.current.active = false;
      stateRef.current.queue = [];
      stateRef.current.activeStreamEvent = null;
      streamCursorRef.current = 0;
    };
  }, [clearTimers]);

  return useMemo(
    () => ({
      enqueue,
      isReplaying,
      remaining,
      flush,
      cancel,
    }),
    [cancel, enqueue, flush, isReplaying, remaining],
  );
}
