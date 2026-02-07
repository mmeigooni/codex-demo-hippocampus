# OpenAI Key Rotation Task

## Status
Required after Wave 02 setup.

## Why
The current API key was shared during setup and should be treated as exposed.

## Required actions
1. Create a replacement OpenAI API key in the OpenAI dashboard.
2. Revoke the current key.
3. Update local `.env.local` with the replacement key.
4. Restart local dev services that cache environment variables.

## Policy
- Never commit secrets.
- Keep `.env.local` untracked.
- Keep `.env.example` placeholder-only.
