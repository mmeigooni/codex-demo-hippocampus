import { describe, expect, it } from "vitest";

import {
  assertProfilesSchemaReady,
  isMissingProfilesTableError,
  ProfilesSchemaNotReadyError,
  SCHEMA_NOT_READY_PROFILES_CODE,
  SCHEMA_NOT_READY_PROFILES_MESSAGE,
} from "@/lib/supabase/schema-guard";

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
    const supabase = {
      from: () => ({
        select: () => ({
          limit: () => ({
            maybeSingle: async () => ({
              error: {
                message: "Could not find the table 'public.profiles' in the schema cache",
              },
            }),
          }),
        }),
      }),
    };

    await expect(assertProfilesSchemaReady(supabase)).rejects.toMatchObject({
      code: SCHEMA_NOT_READY_PROFILES_CODE,
      message: SCHEMA_NOT_READY_PROFILES_MESSAGE,
    });
  });

  it("passes through non-schema-cache errors", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          limit: () => ({
            maybeSingle: async () => ({
              error: {
                message: "permission denied for table profiles",
              },
            }),
          }),
        }),
      }),
    };

    await expect(assertProfilesSchemaReady(supabase)).resolves.toBeUndefined();
  });

  it("exposes code on typed error", () => {
    const error = new ProfilesSchemaNotReadyError();
    expect(error.code).toBe(SCHEMA_NOT_READY_PROFILES_CODE);
  });
});
