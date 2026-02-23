import { afterEach, describe, expect, it } from "vitest";

import {
  assertRequiredColumnsReady,
  assertProfilesSchemaReady,
  isMissingRequiredColumnsError,
  isSchemaFallbackEnabled,
  isMissingProfilesTableError,
  ProfilesSchemaNotReadyError,
  RequiredColumnsSchemaNotReadyError,
  resolveStorageModeAfterProfilesPreflight,
  SCHEMA_NOT_READY_REQUIRED_COLUMNS_CODE,
  SCHEMA_NOT_READY_REQUIRED_COLUMNS_MESSAGE,
  SCHEMA_NOT_READY_PROFILES_CODE,
  SCHEMA_NOT_READY_PROFILES_MESSAGE,
} from "@/lib/supabase/schema-guard";

const originalNodeEnv = process.env.NODE_ENV;

function setNodeEnv(value: string | undefined) {
  (process.env as { NODE_ENV?: string }).NODE_ENV = value;
}

function supabaseWithTableErrors(tableErrors: Record<string, unknown | null>) {
  return {
    from: (table: string) => ({
      select: () => ({
        limit: () => ({
          maybeSingle: async () => ({
            error: table in tableErrors ? tableErrors[table] : null,
          }),
        }),
      }),
    }),
  };
}

afterEach(() => {
  setNodeEnv(originalNodeEnv);
});

describe("isMissingProfilesTableError", () => {
  it("detects schema cache profiles errors", () => {
    const error = {
      message: "Could not find the table 'public.profiles' in the schema cache",
    };

    expect(isMissingProfilesTableError(error)).toBe(true);
  });

  it("does not match unrelated errors", () => {
    const error = {
      message: "permission denied for table repos",
    };

    expect(isMissingProfilesTableError(error)).toBe(false);
  });
});

describe("isMissingRequiredColumnsError", () => {
  it("detects missing episodes.pattern_key errors", () => {
    const error = {
      code: "42703",
      message: "column episodes.pattern_key does not exist",
    };

    expect(isMissingRequiredColumnsError(error)).toBe(true);
  });

  it("detects missing rules.rule_key errors", () => {
    const error = {
      message: "column rules.rule_key does not exist",
    };

    expect(isMissingRequiredColumnsError(error)).toBe(true);
  });

  it("does not match unrelated missing columns", () => {
    const error = {
      code: "42703",
      message: "column episodes.unknown_col does not exist",
    };

    expect(isMissingRequiredColumnsError(error)).toBe(false);
  });
});

describe("assertProfilesSchemaReady", () => {
  it("throws typed schema-not-ready error when profiles table is missing", async () => {
    const supabase = supabaseWithTableErrors({
      profiles: {
        message: "Could not find the table 'public.profiles' in the schema cache",
      },
    });

    await expect(assertProfilesSchemaReady(supabase)).rejects.toMatchObject({
      code: SCHEMA_NOT_READY_PROFILES_CODE,
      message: SCHEMA_NOT_READY_PROFILES_MESSAGE,
    });
  });

  it("passes through non-schema-cache errors", async () => {
    const supabase = supabaseWithTableErrors({
      profiles: {
        message: "permission denied for table profiles",
      },
    });

    await expect(assertProfilesSchemaReady(supabase)).resolves.toBeUndefined();
  });

  it("exposes code on typed error", () => {
    const error = new ProfilesSchemaNotReadyError();
    expect(error.code).toBe(SCHEMA_NOT_READY_PROFILES_CODE);
  });
});

describe("assertRequiredColumnsReady", () => {
  it("throws typed schema-not-ready error when required columns are missing", async () => {
    const supabase = supabaseWithTableErrors({
      episodes: {
        code: "42703",
        message: "column episodes.pattern_key does not exist",
      },
    });

    await expect(assertRequiredColumnsReady(supabase)).rejects.toMatchObject({
      code: SCHEMA_NOT_READY_REQUIRED_COLUMNS_CODE,
      message: SCHEMA_NOT_READY_REQUIRED_COLUMNS_MESSAGE,
    });
  });

  it("passes when required columns are available", async () => {
    const supabase = supabaseWithTableErrors({});
    await expect(assertRequiredColumnsReady(supabase)).resolves.toBeUndefined();
  });

  it("exposes code on typed required-columns error", () => {
    const error = new RequiredColumnsSchemaNotReadyError();
    expect(error.code).toBe(SCHEMA_NOT_READY_REQUIRED_COLUMNS_CODE);
  });
});

describe("schema fallback mode", () => {
  it("uses strict mode in production", () => {
    setNodeEnv("production");
    expect(isSchemaFallbackEnabled()).toBe(false);
  });

  it("uses fallback mode outside production", () => {
    setNodeEnv("development");
    expect(isSchemaFallbackEnabled()).toBe(true);
  });

  it("returns supabase mode when schema is available", async () => {
    setNodeEnv("development");
    const supabase = supabaseWithTableErrors({});

    await expect(resolveStorageModeAfterProfilesPreflight(supabase)).resolves.toBe("supabase");
  });

  it("returns memory-fallback mode for schema cache misses in development", async () => {
    setNodeEnv("development");
    const supabase = supabaseWithTableErrors({
      profiles: {
        message: "Could not find the table 'public.profiles' in the schema cache",
      },
    });

    await expect(resolveStorageModeAfterProfilesPreflight(supabase)).resolves.toBe("memory-fallback");
  });

  it("returns memory-fallback mode for missing required columns in development", async () => {
    setNodeEnv("development");
    const supabase = supabaseWithTableErrors({
      episodes: {
        code: "42703",
        message: "column episodes.pattern_key does not exist",
      },
    });

    await expect(resolveStorageModeAfterProfilesPreflight(supabase)).resolves.toBe("memory-fallback");
  });

  it("throws typed error for schema cache misses in production", async () => {
    setNodeEnv("production");
    const supabase = supabaseWithTableErrors({
      profiles: {
        message: "Could not find the table 'public.profiles' in the schema cache",
      },
    });

    await expect(resolveStorageModeAfterProfilesPreflight(supabase)).rejects.toBeInstanceOf(
      ProfilesSchemaNotReadyError,
    );
  });

  it("throws typed required-columns error in production", async () => {
    setNodeEnv("production");
    const supabase = supabaseWithTableErrors({
      rules: {
        code: "42703",
        message: "column rules.rule_key does not exist",
      },
    });

    await expect(resolveStorageModeAfterProfilesPreflight(supabase)).rejects.toBeInstanceOf(
      RequiredColumnsSchemaNotReadyError,
    );
  });
});
