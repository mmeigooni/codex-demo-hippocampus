"use client";

interface CodeSnippetProps {
  snippet: string;
}

export function CodeSnippet({ snippet }: CodeSnippetProps) {
  return (
    <pre className="max-h-28 overflow-auto rounded-md border border-zinc-800 bg-zinc-950/80 p-2 text-xs text-zinc-300">
      {snippet}
    </pre>
  );
}
