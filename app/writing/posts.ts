/**
 * The writing index, and every post's own metadata, read from here — one entry per
 * post so a title or date is never written down twice.
 */
export type Post = {
  slug: string;
  title: string;
  /** ISO date; the index sorts on it and formats it for display. */
  date: string;
  description: string;
};

export const POSTS: Post[] = [
  {
    slug: "pp",
    title: "Programming Personality",
    date: "2026-08-28",
    description:
      "Ten technologies for shaping affective state, scored 1–10 across efficacy, tolerability, and deployability.",
  },
];

export const postBySlug = (slug: string): Post => {
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) throw new Error(`No post registered for slug "${slug}"`);
  return post;
};

/** Newest first — the order the index lists them in. */
export const postsByDate = () =>
  [...POSTS].sort((a, b) => b.date.localeCompare(a.date));

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
