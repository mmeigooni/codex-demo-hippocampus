export function collectExistingPrNumbers(
  rows: Array<{ source_pr_number: number | null }> | null | undefined,
): Set<number> {
  const numbers = new Set<number>();

  for (const row of rows ?? []) {
    if (typeof row.source_pr_number === "number") {
      numbers.add(row.source_pr_number);
    }
  }

  return numbers;
}

export function isUniqueViolationError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  if (!("code" in error)) {
    return false;
  }

  return String((error as { code?: unknown }).code ?? "") === "23505";
}
