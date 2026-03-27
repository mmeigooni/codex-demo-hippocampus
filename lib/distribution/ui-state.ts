const DEFAULT_PREVIEW_MESSAGE =
  "Preview mode: markdown was generated. Copy it below and open a PR manually.";

export function distributionFallbackMessage(reason?: string) {
  const normalizedReason = reason?.trim();

  if (!normalizedReason || normalizedReason === "memory-fallback") {
    return DEFAULT_PREVIEW_MESSAGE;
  }

  return `Preview mode: markdown was generated, but PR creation failed (${normalizedReason}). Copy it below and open a PR manually.`;
}

