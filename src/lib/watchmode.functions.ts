import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type WatchSourceType = "sub" | "rent" | "buy" | "free" | "tve";

export type WatchSource = {
  id: number;
  name: string;
  type: WatchSourceType;
  region: string;
  webUrl: string | null;
  format: string | null;
  price: number | null;
};

export type WatchAvailability = {
  status: "ok" | "not_found" | "error";
  errorCode?: "missing_key" | "auth" | "rate_limited" | "upstream" | "network";
  sources: WatchSource[];
};

type WatchmodeSearchResult = {
  id: number;
  type?: string;
};

async function readErrorSnippet(res: Response) {
  try {
    return (await res.text()).slice(0, 280);
  } catch {
    return "";
  }
}

function classifyWatchmodeHttp(status: number): WatchAvailability {
  if (status === 401 || status === 403) return { status: "error", errorCode: "auth", sources: [] };
  if (status === 402 || status === 429) return { status: "error", errorCode: "rate_limited", sources: [] };
  if (status === 404) return { status: "not_found", sources: [] };
  return { status: "error", errorCode: "upstream", sources: [] };
}

function logWatchmodeFailure(
  step: "config" | "search" | "sources" | "exception",
  details: Record<string, unknown>,
) {
  console.error("[watchmode] availability lookup failed", { step, ...details });
}

export const getWatchSources = createServerFn({ method: "GET" })
  .inputValidator((input: { tmdbId: number; mediaType: "movie" | "tv"; region?: string }) =>
    z
      .object({
        tmdbId: z.number().int(),
        mediaType: z.enum(["movie", "tv"]),
        region: z.string().min(2).max(4).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<WatchAvailability> => {
    const apiKey = process.env.WATCHMODE_API_KEY;
    if (!apiKey) {
      logWatchmodeFailure("config", {
        reason: "missing WATCHMODE_API_KEY",
        tmdbId: data.tmdbId,
        mediaType: data.mediaType,
        region: data.region ?? "US",
      });
      return { status: "error", errorCode: "missing_key", sources: [] };
    }

    const region = (data.region ?? "US").toUpperCase();
    const expectedTypes = data.mediaType === "movie"
      ? new Set(["movie"])
      : new Set(["tv_series", "tv_miniseries", "tv_special"]);

    try {
      const searchUrl = new URL("https://api.watchmode.com/v1/search/");
      searchUrl.searchParams.set("apiKey", apiKey);
      searchUrl.searchParams.set("search_field", "tmdb_id");
      searchUrl.searchParams.set("search_value", String(data.tmdbId));

      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) {
        logWatchmodeFailure("search", {
          status: searchRes.status,
          tmdbId: data.tmdbId,
          mediaType: data.mediaType,
          region,
          body: await readErrorSnippet(searchRes),
        });
        return classifyWatchmodeHttp(searchRes.status);
      }
      const searchJson = (await searchRes.json()) as {
        title_results?: WatchmodeSearchResult[];
      };

      const results = searchJson.title_results ?? [];
      const matched = results.find((result) => result.type && expectedTypes.has(result.type));
      const wmId = (matched ?? results[0])?.id;
      if (!wmId) return { status: "not_found", sources: [] };

      const sourcesUrl = new URL(`https://api.watchmode.com/v1/title/${wmId}/sources/`);
      sourcesUrl.searchParams.set("apiKey", apiKey);
      sourcesUrl.searchParams.set("regions", region);

      const sourcesRes = await fetch(sourcesUrl);
      if (!sourcesRes.ok) {
        logWatchmodeFailure("sources", {
          status: sourcesRes.status,
          tmdbId: data.tmdbId,
          watchmodeId: wmId,
          mediaType: data.mediaType,
          region,
          body: await readErrorSnippet(sourcesRes),
        });
        return classifyWatchmodeHttp(sourcesRes.status);
      }
      const rows = (await sourcesRes.json()) as Array<{
        source_id: number;
        name: string;
        type: string;
        region: string;
        web_url: string | null;
        format: string | null;
        price: number | null;
      }>;

      const seen = new Set<string>();
      const sources: WatchSource[] = [];
      for (const r of rows) {
        if (r.region && r.region.toUpperCase() !== region) continue;
        const key = `${r.source_id}|${r.type}|${r.format ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        sources.push({
          id: r.source_id,
          name: r.name,
          type: r.type as WatchSourceType,
          region: r.region,
          webUrl: r.web_url ?? null,
          format: r.format ?? null,
          price: r.price ?? null,
        });
      }
      return { status: "ok", sources };
    } catch (error) {
      logWatchmodeFailure("exception", {
        tmdbId: data.tmdbId,
        mediaType: data.mediaType,
        region,
        message: error instanceof Error ? error.message : String(error),
      });
      return { status: "error", errorCode: "network", sources: [] };
    }
  });
