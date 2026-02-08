export const SCHEMA_NOT_READY_PROFILES_CODE = "SCHEMA_NOT_READY_PROFILES";

export const SCHEMA_NOT_READY_PROFILES_MESSAGE =
  "Schema not ready: required table public.profiles is missing from Supabase schema cache. Run migrations and refresh the schema cache before retrying.";

interface SupabaseLikeClient {
  from: (table: string) => {
    select: (columns: string) => {
      limit: (count: number) => {
        maybeSingle: () => unknown;
      };
    };
  };
}

export type StorageMode = "supabase" | "memory-fallback";

function extractErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    const withMessage = error as { message?: unknown };
    if (typeof withMessage.message === "string") {
      return withMessage.message;
    }
  }

  return "";
}

export function isMissingProfilesTableError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  if (code === "PGRST205") {
    return true;
  }

  return (
    (message.includes("could not find the table") || message.includes("relation") || message.includes("table")) &&
    message.includes("profiles") &&
    (message.includes("schema cache") || message.includes("public.profiles"))
  );
}

export class ProfilesSchemaNotReadyError extends Error {
  code = SCHEMA_NOT_READY_PROFILES_CODE;

  constructor(message = SCHEMA_NOT_READY_PROFILES_MESSAGE) {
    super(message);
    this.name = "ProfilesSchemaNotReadyError";
  }
}

export function isProfilesSchemaNotReadyError(error: unknown): error is ProfilesSchemaNotReadyError {
  if (error instanceof ProfilesSchemaNotReadyError) {
    return true;
  }

  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    String((error as { code?: unknown }).code ?? "") === SCHEMA_NOT_READY_PROFILES_CODE
  );
}

export async function assertProfilesSchemaReady(supabase: SupabaseLikeClient) {
  const result = (await supabase.from("profiles").select("id").limit(1).maybeSingle()) as {
    error?: unknown | null;
  } | null;
  const error = result?.error ?? null;

  if (error && isMissingProfilesTableError(error)) {
    throw new ProfilesSchemaNotReadyError();
  }
}

export function isSchemaFallbackEnabled() {
  return process.env.NODE_ENV !== "production";
}

export async function resolveStorageModeAfterProfilesPreflight(
  supabase: SupabaseLikeClient,
): Promise<StorageMode> {
  try {
    await assertProfilesSchemaReady(supabase);
    return "supabase";
  } catch (error) {
    if (!isProfilesSchemaNotReadyError(error) && !isMissingProfilesTableError(error)) {
      throw error;
    }

    if (!isSchemaFallbackEnabled()) {
      throw new ProfilesSchemaNotReadyError();
    }

    console.warn(
      `[schema-guard] Falling back to in-memory runtime store because public.profiles is missing in schema cache (${SCHEMA_NOT_READY_PROFILES_CODE})`,
    );
    return "memory-fallback";
  }
}
