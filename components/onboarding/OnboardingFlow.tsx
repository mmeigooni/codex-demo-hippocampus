"use client";

import { useMemo, useState } from "react";

import { RepoSelector } from "@/components/onboarding/RepoSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImportEvent, ImportRepoRequest } from "@/lib/github/types";

interface OnboardingFlowProps {
  demoRepoFullName: string;
}

interface ParsedImportEvent {
  type: string;
  data: Record<string, unknown>;
}

function extractEventsFromBuffer(rawBuffer: string) {
  const chunks = rawBuffer.split("\n\n");
  const remainder = chunks.pop() ?? "";

  const events = chunks
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .flatMap((chunk) => {
      const line = chunk
        .split("\n")
        .find((chunkLine) => chunkLine.startsWith("data: "));

      if (!line) {
        return [];
      }

      const payloadText = line.slice(6);

      try {
        return [JSON.parse(payloadText) as ParsedImportEvent];
      } catch {
        return [];
      }
    });

  return { events, remainder };
}

export function OnboardingFlow({ demoRepoFullName }: OnboardingFlowProps) {
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [events, setEvents] = useState<ImportEvent[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusText = useMemo(() => {
    if (error) {
      return error;
    }

    if (isImporting) {
      return "Import in progress...";
    }

    const latestEvent = events[events.length - 1];
    if (!latestEvent) {
      return "Select a repository to begin.";
    }

    if (latestEvent.type === "complete") {
      const total = String(latestEvent.data.total ?? "0");
      return `Import complete. ${total} episodes created.`;
    }

    return `Last event: ${latestEvent.type}`;
  }, [error, events, isImporting]);

  const startImport = async (repoSelection: ImportRepoRequest) => {
    const fullName = `${repoSelection.owner}/${repoSelection.repo}`;
    setActiveRepo(fullName);
    setEvents([]);
    setError(null);
    setIsImporting(true);

    try {
      const response = await fetch("/api/github/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(repoSelection),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to start import stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parsed = extractEventsFromBuffer(buffer);
        if (parsed.events.length > 0) {
          setEvents((current) => [...current, ...(parsed.events as ImportEvent[])]);
        }
        buffer = parsed.remainder;
      }
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "Import failed";
      setError(message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <RepoSelector demoRepoFullName={demoRepoFullName} onSelectRepo={startImport} disabled={isImporting} />

      <Card className="border-zinc-800 bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-zinc-100">Neural activity stream</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-300">{statusText}</p>
          {activeRepo ? <p className="text-xs text-zinc-500">Active repo: {activeRepo}</p> : null}

          <div className="max-h-72 space-y-2 overflow-auto rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            {events.length === 0 ? (
              <p className="text-sm text-zinc-500">Waiting for events...</p>
            ) : (
              events.map((event, index) => (
                <div key={`${event.type}-${index}`} className="rounded border border-zinc-800 bg-zinc-900/50 p-2">
                  <p className="font-mono text-xs text-cyan-300">{event.type}</p>
                  <pre className="mt-1 overflow-auto text-xs text-zinc-300">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
