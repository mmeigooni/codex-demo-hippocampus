#!/usr/bin/env node

const REQUIRED_ENV_KEYS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
const REQUIRED_TABLES = [
  "profiles",
  "repos",
  "episodes",
  "rules",
  "index_entries",
  "consolidation_runs",
];

function fail(message) {
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function isLikelySchemaError(message) {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("schema cache") ||
    normalized.includes("could not find the table") ||
    normalized.includes("public.") ||
    normalized.includes("relation")
  );
}

function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchWithBody(url, headers) {
  const response = await fetch(url, { headers });
  const text = await response.text();
  const json = parseJsonSafely(text);
  return { response, text, json };
}

async function main() {
  let hasErrors = false;

  for (const key of REQUIRED_ENV_KEYS) {
    if (!process.env[key] || process.env[key].trim().length === 0) {
      fail(`Missing required environment variable: ${key}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error(
      "Action: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local and retry.",
    );
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  let baseUrl;
  try {
    baseUrl = new URL(supabaseUrl);
  } catch {
    fail(`Invalid NEXT_PUBLIC_SUPABASE_URL value: ${supabaseUrl}`);
    process.exit(1);
  }

  if (baseUrl.protocol !== "https:") {
    fail("NEXT_PUBLIC_SUPABASE_URL must use https.");
    process.exit(1);
  }

  if (!baseUrl.hostname.endsWith(".supabase.co")) {
    fail("NEXT_PUBLIC_SUPABASE_URL must target a *.supabase.co hostname.");
    process.exit(1);
  }

  const authHeaders = { apikey: publishableKey };
  const restHeaders = {
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
  };

  const authSettingsUrl = new URL("/auth/v1/settings", baseUrl).toString();
  try {
    const { response, text, json } = await fetchWithBody(authSettingsUrl, authHeaders);

    if (!response.ok) {
      fail(`Auth settings check failed (${response.status}) at ${authSettingsUrl}: ${text}`);
      process.exit(1);
    }

    const githubEnabled = Boolean(json?.external?.github);
    if (!githubEnabled) {
      fail("Supabase Auth GitHub provider is disabled.");
      console.error("Action: enable GitHub provider in Supabase Auth settings before running imports.");
      process.exit(1);
    }

    pass("Auth settings reachable and GitHub provider is enabled.");
  } catch (error) {
    fail(`Could not reach Supabase auth settings: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  for (const table of REQUIRED_TABLES) {
    const tableUrl = new URL(`/rest/v1/${table}`, baseUrl);
    tableUrl.searchParams.set("select", "id");
    tableUrl.searchParams.set("limit", "1");

    try {
      const { response, text, json } = await fetchWithBody(tableUrl.toString(), restHeaders);

      if (!response.ok) {
        const schemaHint = isLikelySchemaError(text)
          ? " Action: run migrations in supabase/migrations and refresh Supabase schema cache."
          : "";
        fail(`Table check failed for ${table} (${response.status}): ${text}${schemaHint}`);
        hasErrors = true;
        continue;
      }

      if (!Array.isArray(json)) {
        fail(
          `Unexpected response for ${table}: expected JSON array, got ${json === null ? "non-JSON" : typeof json}.`,
        );
        hasErrors = true;
        continue;
      }

      pass(`Data API table check passed: ${table}.`);
    } catch (error) {
      fail(`Request failed for table ${table}: ${error instanceof Error ? error.message : String(error)}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error("Supabase preflight check completed with failures.");
    process.exit(1);
  }

  console.log("Supabase preflight check succeeded.");
}

await main();
