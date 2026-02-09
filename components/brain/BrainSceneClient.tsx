"use client";

import { Component, type ComponentProps, type ReactNode, useCallback, useEffect, useState } from "react";

type BrainSceneComponent = typeof import("@/components/brain/BrainScene").BrainScene;
type BrainSceneProps = ComponentProps<BrainSceneComponent>;

interface LocalSceneErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError: (error: Error) => void;
  resetKey: number;
}

interface LocalSceneErrorBoundaryState {
  hasError: boolean;
}

class LocalSceneErrorBoundary extends Component<LocalSceneErrorBoundaryProps, LocalSceneErrorBoundaryState> {
  state: LocalSceneErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  componentDidUpdate(prevProps: LocalSceneErrorBoundaryProps) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function resolveErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function SceneFallback({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
      <p>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex rounded-md border border-zinc-600/80 bg-zinc-900 px-3 py-1 text-xs text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800"
        >
          Retry graph
        </button>
      ) : null}
    </div>
  );
}

export function BrainSceneClient(props: BrainSceneProps) {
  const [SceneComponent, setSceneComponent] = useState<BrainSceneComponent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sceneRuntimeError, setSceneRuntimeError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setSceneComponent(null);
    setLoadError(null);
    setSceneRuntimeError(null);

    import("@/components/brain/BrainScene")
      .then((module) => {
        if (cancelled) {
          return;
        }

        setSceneComponent(() => module.BrainScene);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setLoadError(resolveErrorMessage(error, "Failed to load memory graph."));
      });

    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  const handleRuntimeError = useCallback((error: Error) => {
    setSceneRuntimeError(resolveErrorMessage(error, "Memory graph failed to render."));
  }, []);

  const handleRetry = useCallback(() => {
    setRetryToken((current) => current + 1);
  }, []);

  if (loadError) {
    return <SceneFallback message={loadError} onRetry={handleRetry} />;
  }

  if (!SceneComponent) {
    return <SceneFallback message="Loading memory graph..." />;
  }

  return (
    <LocalSceneErrorBoundary
      fallback={<SceneFallback message={sceneRuntimeError ?? "Memory graph failed to render."} onRetry={handleRetry} />}
      onError={handleRuntimeError}
      resetKey={retryToken}
    >
      <SceneComponent key={`brain-scene-${retryToken}`} {...props} />
    </LocalSceneErrorBoundary>
  );
}
