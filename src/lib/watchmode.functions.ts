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
  sources: WatchSource[];
};

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
    if (!apiKey) return { status: "error", sources: [] };

    const region = (data.region ?? "US").toUpperCase();
    const types = data.mediaType === "movie" ? "movie" : "tv_series";

    try {
      const searchUrl = `https://api.watchmode.com/v1/search/?apiKey=${apiKey}&search_field=tmdb_id&search_value=${data.tmdbId}&types=${types}`;
      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) return { status: "error", sources: [] };
      const searchJson = (await searchRes.json()) as {
        title_results?: Array<{ id: number }>;
      };
      const wmId = searchJson.title_results?.[0]?.id;
      if (!wmId) return { status: "not_found", sources: [] };

      const sourcesUrl = `https://api.watchmode.com/v1/title/${wmId}/sources/?apiKey=${apiKey}&regions=${region}`;
      const sourcesRes = await fetch(sourcesUrl);
      if (!sourcesRes.ok) return { status: "error", sources: [] };
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
    } catch {
      return { status: "error", sources: [] };
    }
  });
