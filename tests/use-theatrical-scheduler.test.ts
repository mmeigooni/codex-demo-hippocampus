import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTheatricalSchedulerController,
  type ScheduledEvent,
} from "@/hooks/useTheatricalScheduler";

describe("createTheatricalSchedulerController", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("releases events in order using interval overrides", () => {
    vi.useFakeTimers({ now: 0 });

    const released: Array<{ type: string; at: number }> = [];
    const onComplete = vi.fn();
    const controller = createTheatricalSchedulerController<ScheduledEvent>({
      defaultIntervalMs: 100,
      intervalOverrides: {
        first: 10,
        second: 20,
      },
      onEventRelease: (event) => {
        released.push({ type: event.type, at: Date.now() });
      },
      onComplete,
    });

    controller.enqueue([
      { type: "first", data: {} },
      { type: "second", data: {} },
      { type: "third", data: {} },
    ]);

    expect(controller.getSnapshot()).toMatchObject({ isReplaying: true, remaining: 2 });

    vi.advanceTimersByTime(10);
    expect(released).toEqual([{ type: "first", at: 10 }]);

    vi.advanceTimersByTime(20);
    expect(released).toEqual([
      { type: "first", at: 10 },
      { type: "second", at: 30 },
    ]);

    vi.advanceTimersByTime(100);
    expect(released).toEqual([
      { type: "first", at: 10 },
      { type: "second", at: 30 },
      { type: "third", at: 130 },
    ]);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({ isReplaying: false, remaining: 0 });
  });

  it("cancels active replay and clears pending events", () => {
    vi.useFakeTimers();

    const onRelease = vi.fn();
    const onComplete = vi.fn();
    const controller = createTheatricalSchedulerController<ScheduledEvent>({
      defaultIntervalMs: 50,
      onEventRelease: onRelease,
      onComplete,
    });

    controller.enqueue([
      { type: "first", data: {} },
      { type: "second", data: {} },
    ]);

    controller.cancel();
    vi.advanceTimersByTime(500);

    expect(onRelease).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ isReplaying: false, remaining: 0 });
  });

  it("replaces an active replay when enqueue is called again", () => {
    vi.useFakeTimers();

    const released: string[] = [];
    const controller = createTheatricalSchedulerController<ScheduledEvent>({
      defaultIntervalMs: 100,
      onEventRelease: (event) => released.push(event.type),
    });

    controller.enqueue([
      { type: "old-1", data: {} },
      { type: "old-2", data: {} },
    ]);

    vi.advanceTimersByTime(100);
    expect(released).toEqual(["old-1"]);

    controller.enqueue([
      { type: "new-1", data: {} },
      { type: "new-2", data: {} },
    ]);

    vi.runAllTimers();

    expect(released).toEqual(["old-1", "new-1", "new-2"]);
  });

  it("flushes all remaining events immediately", () => {
    vi.useFakeTimers();

    const released: string[] = [];
    const onComplete = vi.fn();
    const controller = createTheatricalSchedulerController<ScheduledEvent>({
      defaultIntervalMs: 100,
      onEventRelease: (event) => released.push(event.type),
      onComplete,
    });

    controller.enqueue([
      { type: "first", data: {} },
      { type: "second", data: {} },
      { type: "third", data: {} },
    ]);

    vi.advanceTimersByTime(100);
    expect(released).toEqual(["first"]);

    controller.flush();

    expect(released).toEqual(["first", "second", "third"]);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({ isReplaying: false, remaining: 0 });
  });

  it("streams text as accumulated chunks and emits final completion", () => {
    vi.useFakeTimers();

    const chunked: string[] = [];
    const completed: string[] = [];
    const streamText = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    const controller = createTheatricalSchedulerController<ScheduledEvent>({
      defaultIntervalMs: 0,
      onTextStreamChunk: (_event, text) => chunked.push(text),
      onTextStreamComplete: (_event, text) => completed.push(text),
    });

    controller.enqueue([
      {
        type: "reasoning_complete",
        data: {},
        streamText,
      },
    ]);

    vi.runAllTimers();

    expect(chunked.length).toBeGreaterThan(1);
    expect(chunked[0]).toBe(streamText.slice(0, 20));
    expect(chunked[chunked.length - 1]).toBe(streamText);
    expect(completed).toEqual([streamText]);
  });

  it("does nothing when enqueue is called with an empty batch", () => {
    vi.useFakeTimers();

    const onRelease = vi.fn();
    const controller = createTheatricalSchedulerController<ScheduledEvent>({
      onEventRelease: onRelease,
    });

    controller.enqueue([]);
    vi.runAllTimers();

    expect(onRelease).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ isReplaying: false, remaining: 0 });
  });
});
