export const SCHEMA_NOT_READY_PROFILES_CODE = "SCHEMA_NOT_READY_PROFILES";
export const SCHEMA_NOT_READY_REQUIRED_COLUMNS_CODE = "SCHEMA_NOT_READY_REQUIRED_COLUMNS";

export const SCHEMA_NOT_READY_PROFILES_MESSAGE =
  "Schema not ready: required table public.profiles is missing from Supabase schema cache. Run migrations and refresh the schema cache before retrying.";
export const SCHEMA_NOT_READY_REQUIRED_COLUMNS_MESSAGE =
  "Schema not ready: required columns (episodes.pattern_key, rules.rule_key) are missing. Run migration 002_pattern_rule_keys.sql before retrying.";

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

function extractErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return "";
  }

  return String((error as { code?: unknown }).code ?? "");
}

export function isMissingProfilesTableError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  const code = extractErrorCode(error);

  if (code === "PGRST205") {
    return true;
  }

  return (
    (message.includes("could not find the table") || message.includes("relation") || message.includes("table")) &&
    message.includes("profiles") &&
    (message.includes("schema cache") || message.includes("public.profiles"))
  );
}

export function isMissingRequiredColumnsError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  const code = extractErrorCode(error);

  const mentionsRequiredColumn =
    message.includes("episodes.pattern_key") || message.includes("rules.rule_key");
  if (!mentionsRequiredColumn) {
    return false;
  }

  return (
    code === "42703" ||
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("undefined column")
  );
}

export class ProfilesSchemaNotReadyError extends Error {
  code = SCHEMA_NOT_READY_PROFILES_CODE;

  constructor(message = SCHEMA_NOT_READY_PROFILES_MESSAGE) {
    super(message);
    this.name = "ProfilesSchemaNotReadyError";
  }
}

export class RequiredColumnsSchemaNotReadyError extends Error {
  code = SCHEMA_NOT_READY_REQUIRED_COLUMNS_CODE;

  constructor(message = SCHEMA_NOT_READY_REQUIRED_COLUMNS_MESSAGE) {
    super(message);
    this.name = "RequiredColumnsSchemaNotReadyError";
  }
}

export type SchemaNotReadyError =
  | ProfilesSchemaNotReadyError
  | RequiredColumnsSchemaNotReadyError;

export function isProfilesSchemaNotReadyError(error: unknown): error is SchemaNotReadyError {
  if (error instanceof ProfilesSchemaNotReadyError) {
    return true;
  }

  if (error instanceof RequiredColumnsSchemaNotReadyError) {
    return true;
  }

  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (String((error as { code?: unknown }).code ?? "") === SCHEMA_NOT_READY_PROFILES_CODE ||
      String((error as { code?: unknown }).code ?? "") === SCHEMA_NOT_READY_REQUIRED_COLUMNS_CODE)
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

export async function assertRequiredColumnsReady(supabase: SupabaseLikeClient) {
  const [episodesResult, rulesResult] = (await Promise.all([
    supabase.from("episodes").select("id,pattern_key").limit(1).maybeSingle(),
    supabase.from("rules").select("id,rule_key").limit(1).maybeSingle(),
  ])) as Array<{ error?: unknown | null } | null>;

  const errors = [episodesResult?.error ?? null, rulesResult?.error ?? null];
  const missingColumns = errors.some((error) => error && isMissingRequiredColumnsError(error));

  if (missingColumns) {
    throw new RequiredColumnsSchemaNotReadyError();
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
    await assertRequiredColumnsReady(supabase);
    return "supabase";
  } catch (error) {
    if (
      !isProfilesSchemaNotReadyError(error) &&
      !isMissingProfilesTableError(error) &&
      !isMissingRequiredColumnsError(error)
    ) {
      throw error;
    }

    const schemaError: SchemaNotReadyError =
      error instanceof ProfilesSchemaNotReadyError || error instanceof RequiredColumnsSchemaNotReadyError
        ? error
        : isMissingProfilesTableError(error)
          ? new ProfilesSchemaNotReadyError()
          : new RequiredColumnsSchemaNotReadyError();

    if (!isSchemaFallbackEnabled()) {
      throw schemaError;
    }

    console.warn(
      `[schema-guard] Falling back to in-memory runtime store because required Supabase schema is not ready (${schemaError.code})`,
    );
    return "memory-fallback";
  }
}
