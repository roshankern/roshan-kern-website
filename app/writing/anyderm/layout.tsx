import GlassBackground from "../../components/GlassBackground";

/**
 * A post is just its content — no back navigation, by design. Width is set per
 * element in mdx-components.tsx, so this only centres what it is given.
 */
export default function PostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Darker than the index: the image should not compete with the prose. */}
      <GlassBackground scrim="bg-black/90" />
      <article
        // Markdown wraps an image in a paragraph; any caption text sharing that
        // paragraph is centred under it, so captions need no special markup.
        className="relative z-10 w-full max-w-5xl flex flex-col items-center [&>p:has(img)]:text-center"
      >
        {children}
      </article>
    </>
  );
}
