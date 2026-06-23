import { createServerFn } from "@tanstack/react-start";

export type TmdbResult = {
  id: number;
  title: string;
  year: string | null;
  posterUrl: string | null;
  mediaType: "movie" | "tv";
};

export const searchTmdb = createServerFn({ method: "GET" })
  .inputValidator((input: { query: string }) => {
    if (typeof input?.query !== "string") throw new Error("query required");
    return { query: input.query.trim().slice(0, 200) };
  })
  .handler(async ({ data }): Promise<TmdbResult[]> => {
    if (!data.query) return [];
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) throw new Error("TMDB_API_KEY not configured");

    const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(
      data.query,
    )}&api_key=${apiKey}&include_adult=false`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
    const json = (await res.json()) as {
      results: Array<{
        id: number;
        media_type: string;
        title?: string;
        name?: string;
        release_date?: string;
        first_air_date?: string;
        poster_path?: string | null;
      }>;
    };

    return json.results
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .map((r) => {
        const isMovie = r.media_type === "movie";
        const date = isMovie ? r.release_date : r.first_air_date;
        return {
          id: r.id,
          title: (isMovie ? r.title : r.name) ?? "Untitled",
          year: date ? date.slice(0, 4) : null,
          posterUrl: r.poster_path
            ? `https://image.tmdb.org/t/p/w500${r.poster_path}`
            : null,
          mediaType: isMovie ? "movie" : "tv",
        };
      });
  });
