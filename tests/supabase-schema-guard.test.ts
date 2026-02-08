import { afterEach, describe, expect, it } from "vitest";

import {
  assertProfilesSchemaReady,
  isSchemaFallbackEnabled,
  isMissingProfilesTableError,
  ProfilesSchemaNotReadyError,
  resolveStorageModeAfterProfilesPreflight,
  SCHEMA_NOT_READY_PROFILES_CODE,
  SCHEMA_NOT_READY_PROFILES_MESSAGE,
} from "@/lib/supabase/schema-guard";

const originalNodeEnv = process.env.NODE_ENV;

function setNodeEnv(value: string | undefined) {
  (process.env as { NODE_ENV?: string }).NODE_ENV = value;
}

function supabaseWithErrorMessage(message: string) {
  return {
    from: () => ({
      select: () => ({
        limit: () => ({
          maybeSingle: async () => ({
            error: {
              message,
            },
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

describe("assertProfilesSchemaReady", () => {
  it("throws typed schema-not-ready error when profiles table is missing", async () => {
    const supabase = supabaseWithErrorMessage(
      "Could not find the table 'public.profiles' in the schema cache",
    );

    await expect(assertProfilesSchemaReady(supabase)).rejects.toMatchObject({
      code: SCHEMA_NOT_READY_PROFILES_CODE,
      message: SCHEMA_NOT_READY_PROFILES_MESSAGE,
    });
  });

  it("passes through non-schema-cache errors", async () => {
    const supabase = supabaseWithErrorMessage("permission denied for table profiles");

    await expect(assertProfilesSchemaReady(supabase)).resolves.toBeUndefined();
  });

  it("exposes code on typed error", () => {
    const error = new ProfilesSchemaNotReadyError();
    expect(error.code).toBe(SCHEMA_NOT_READY_PROFILES_CODE);
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
    const supabase = {
      from: () => ({
        select: () => ({
          limit: () => ({
            maybeSingle: async () => ({ error: null }),
          }),
        }),
      }),
    };

    await expect(resolveStorageModeAfterProfilesPreflight(supabase)).resolves.toBe("supabase");
  });

  it("returns memory-fallback mode for schema cache misses in development", async () => {
    setNodeEnv("development");
    const supabase = supabaseWithErrorMessage(
      "Could not find the table 'public.profiles' in the schema cache",
    );

    await expect(resolveStorageModeAfterProfilesPreflight(supabase)).resolves.toBe("memory-fallback");
  });

  it("throws typed error for schema cache misses in production", async () => {
    setNodeEnv("production");
    const supabase = supabaseWithErrorMessage(
      "Could not find the table 'public.profiles' in the schema cache",
    );

    await expect(resolveStorageModeAfterProfilesPreflight(supabase)).rejects.toBeInstanceOf(
      ProfilesSchemaNotReadyError,
    );
  });
});
