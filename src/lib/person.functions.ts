import { createServerFn } from "@tanstack/react-start";

export type PersonCredit = {
  id: number;
  title: string;
  year: string | null;
  posterUrl: string | null;
  mediaType: "movie" | "tv";
  character: string | null;
  job: string | null;
  voteCount: number;
};

export type PersonDetail = {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  knownForDepartment: string | null;
  profileUrl: string | null;
  homepage: string | null;
  knownFor: PersonCredit[];
  directing: PersonCredit[];
  actingTotal: number;
  directingTotal: number;
};

export const getPerson = createServerFn({ method: "GET" })
  .inputValidator((input: { id: number }) => {
    const id = Number(input?.id);
    if (!Number.isFinite(id) || id <= 0) throw new Error("invalid id");
    return { id };
  })
  .handler(async ({ data }): Promise<PersonDetail | null> => {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) throw new Error("TMDB_API_KEY not configured");

    const url = `https://api.themoviedb.org/3/person/${data.id}?api_key=${apiKey}&append_to_response=combined_credits`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`TMDB error: ${res.status}`);

    const json = (await res.json()) as {
      id: number;
      name: string;
      biography?: string;
      birthday?: string | null;
      deathday?: string | null;
      place_of_birth?: string | null;
      known_for_department?: string | null;
      profile_path?: string | null;
      homepage?: string | null;
      combined_credits?: {
        cast?: Array<any>;
        crew?: Array<any>;
      };
    };

    const mapCredit = (r: any, role: "cast" | "crew"): PersonCredit => {
      const isMovie = r.media_type === "movie";
      const date = isMovie ? r.release_date : r.first_air_date;
      return {
        id: r.id,
        title: (isMovie ? r.title : r.name) ?? "Untitled",
        year: date ? String(date).slice(0, 4) : null,
        posterUrl: r.poster_path
          ? `https://image.tmdb.org/t/p/w342${r.poster_path}`
          : null,
        mediaType: isMovie ? "movie" : "tv",
        character: role === "cast" ? (r.character ?? null) : null,
        job: role === "crew" ? (r.job ?? null) : null,
        voteCount: r.vote_count ?? 0,
      };
    };

    const cast = (json.combined_credits?.cast ?? [])
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .map((r) => mapCredit(r, "cast"));
    const crew = (json.combined_credits?.crew ?? [])
      .filter((r) => r.media_type === "movie" || r.media_type === "tv");

    const directing = crew
      .filter((r) => r.job === "Director")
      .map((r) => mapCredit(r, "crew"));

    // Dedupe by id+mediaType, keep highest vote_count
    const dedupe = (arr: PersonCredit[]) => {
      const map = new Map<string, PersonCredit>();
      for (const c of arr) {
        const key = `${c.mediaType}-${c.id}`;
        const ex = map.get(key);
        if (!ex || c.voteCount > ex.voteCount) map.set(key, c);
      }
      return Array.from(map.values());
    };

    const knownFor = dedupe(cast)
      .sort((a, b) => b.voteCount - a.voteCount)
      .slice(0, 24);
    const directingTop = dedupe(directing)
      .sort((a, b) => b.voteCount - a.voteCount)
      .slice(0, 24);

    return {
      id: json.id,
      name: json.name,
      biography: json.biography ?? "",
      birthday: json.birthday ?? null,
      deathday: json.deathday ?? null,
      placeOfBirth: json.place_of_birth ?? null,
      knownForDepartment: json.known_for_department ?? null,
      profileUrl: json.profile_path
        ? `https://image.tmdb.org/t/p/w342${json.profile_path}`
        : null,
      homepage: json.homepage ?? null,
      knownFor,
      directing: directingTop,
      actingTotal: dedupe(cast).length,
      directingTotal: dedupe(directing).length,
    };
  });
