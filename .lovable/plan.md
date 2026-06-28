## What I found

The Watchmode secret **is present** (`WATCHMODE_API_KEY` exists), so this is not simply “missing key.” The current app intentionally hides provider errors and returns `{ status: "error" }`, which is why the UI only shows **“Availability unavailable.”**

The likely causes are:

1. **Published server function mismatch**: production logs still show an older-style server-function route failing with `Server function info not found`, which means some clients/deploy cache may still be calling the stale Watchmode handler.
2. **Watchmode API request failure**: the current function returns `error` whenever Watchmode responds non-2xx, but it does not log the upstream status/body, so we can’t tell whether it is an invalid key, quota/rate limit, plan restriction, endpoint mismatch, or lookup failure.
3. **Query serialization / server-function URL differences**: recent preview traffic shows the Watchmode server function is registered, but it still returns `status: "error"`, pointing to an upstream Watchmode problem rather than only deployment.

## Plan

1. **Add safe server-side diagnostics**
   - Update `src/lib/watchmode.functions.ts` to log non-sensitive Watchmode failure details: request step (`search` or `sources`), HTTP status, TMDB id, media type, and region.
   - Do not log the API key or full URL.

2. **Make Watchmode failure states more precise**
   - Distinguish:
     - missing key
     - unauthorized/invalid key
     - quota/rate limit
     - title not found
     - upstream API unavailable
   - Keep the UI simple, but avoid treating all cases as the same generic error internally.

3. **Harden the Watchmode lookup**
   - Check whether the Watchmode `types` parameter is causing misses or errors for TV titles.
   - If needed, perform TMDB-id lookup without over-filtering, then pick the best matching result by `type`.

4. **Improve the UI fallback copy slightly**
   - Keep the Y2K look and layout unchanged.
   - Show “Availability unavailable” for true upstream/key failures and “Not currently available in US” for successful empty results.

5. **Verify against known titles**
   - Test a popular movie and TV show expected to have US providers.
   - Check server logs after the function runs to confirm whether Watchmode says invalid key, quota, or another API error.

6. **Republish after the fix**
   - Once diagnostics/fix are in place and verified in preview, publish the app again so production gets the updated Watchmode function.