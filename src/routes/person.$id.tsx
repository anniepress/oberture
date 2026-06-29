import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPerson, type PersonCredit, type PersonDetail } from "@/lib/person.functions";

export const Route = createFileRoute("/person/$id")({
  loader: async ({ params }) => {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) throw notFound();
    const person = await getPerson({ data: { id } });
    if (!person) throw notFound();
    return { person };
  },
  head: ({ loaderData, params }) => {
    const person = loaderData?.person;
    const url = `https://oberture.lovable.app/person/${params.id}`;
    if (!person) {
      return {
        meta: [{ title: "Person — Oberture" }],
        links: [{ rel: "canonical", href: url }],
      };
    }
    const role = person.knownForDepartment === "Directing" ? "filmography" : "movies";
    const title = `${person.name} ${role} — Oberture`;
    const description = person.biography
      ? `${person.name} filmography on Oberture: movies, TV shows, and roles. ${person.biography.slice(0, 140).trim()}`.slice(0, 300)
      : `Browse ${person.name}'s complete filmography — movies, TV shows, and director credits — on Oberture.`;
    return {
      meta: [
        { title },
        { name: "description", content: description.slice(0, 160) },
        { property: "og:title", content: title },
        { property: "og:description", content: description.slice(0, 200) },
        { property: "og:url", content: url },
        { property: "og:type", content: "profile" },
        ...(person.profileUrl
          ? [{ property: "og:image", content: person.profileUrl }]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: person.name,
            description: person.biography || undefined,
            birthDate: person.birthday || undefined,
            deathDate: person.deathday || undefined,
            birthPlace: person.placeOfBirth || undefined,
            jobTitle: person.knownForDepartment || undefined,
            image: person.profileUrl || undefined,
            url,
          }),
        },
      ],
    };
  },
  component: PersonPage,
});

function PersonPage() {
  const { person } = Route.useLoaderData() as { person: PersonDetail };
  const isDirector = person.knownForDepartment === "Directing";

  return (
    <main className="min-h-screen px-4 pt-14 pb-24 sm:pt-20">
      <div className="mx-auto max-w-6xl">
        <header className="grid gap-6 sm:grid-cols-[180px_1fr] sm:items-start">
          <div className="aspect-[2/3] w-full max-w-[180px] overflow-hidden rounded-sm border border-border bg-card">
            {person.profileUrl ? (
              <img
                src={person.profileUrl}
                alt={`${person.name} portrait`}
                loading="eager"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
                No image
              </div>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {person.knownForDepartment ?? "Person"}
            </p>
            <h1
              className="wordmark mt-2 text-4xl sm:text-5xl leading-tight"
              style={{ color: "var(--cyber-cyan)" }}
            >
              {person.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isDirector ? "Filmography" : "Movies & TV"} ·{" "}
              {person.actingTotal} acting · {person.directingTotal} directing
            </p>
            {(person.birthday || person.placeOfBirth) && (
              <p className="mt-3 text-xs uppercase tracking-[0.25em] text-muted-foreground">
                {[person.birthday, person.placeOfBirth].filter(Boolean).join(" · ")}
                {person.deathday ? ` · d. ${person.deathday}` : ""}
              </p>
            )}
            {person.biography && (
              <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                {person.biography.length > 600
                  ? person.biography.slice(0, 600).trim() + "…"
                  : person.biography}
              </p>
            )}
          </div>
        </header>

        <div className="chrome-divider my-10 w-full" />

        {person.directing.length > 0 && (
          <Section
            heading={`${person.name} — Director filmography`}
            credits={person.directing}
            showRole="job"
          />
        )}
        {person.knownFor.length > 0 && (
          <Section
            heading={`${person.name} — Acting credits`}
            credits={person.knownFor}
            showRole="character"
          />
        )}
      </div>
    </main>
  );
}

function Section({
  heading,
  credits,
  showRole,
}: {
  heading: string;
  credits: PersonCredit[];
  showRole: "character" | "job";
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        {heading}
      </h2>
      <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {credits.map((c) => (
          <div key={`${c.mediaType}-${c.id}`} className="block">
            <div className="aspect-[2/3] w-full overflow-hidden rounded-sm border border-border bg-card">
              {c.posterUrl ? (
                <img
                  src={c.posterUrl}
                  alt={`${c.title} poster`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-muted-foreground">
                  {c.title}
                </div>
              )}
            </div>
            <h3 className="mt-2 line-clamp-2 text-sm font-medium text-foreground">
              {c.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              {c.year ?? "—"}
              {showRole === "character" && c.character ? ` · as ${c.character}` : ""}
              {showRole === "job" && c.job ? ` · ${c.job}` : ""}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
