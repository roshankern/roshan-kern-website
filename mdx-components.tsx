import type { MDXComponents } from "mdx/types";
import MindStateFigure from "./app/components/MindStateFigure";
import ProfilePlot from "./app/components/ProfilePlot";
import ApproachesFigure from "./app/components/ApproachesFigure";

/**
 * Every markdown element gets its glass-theme styling here, once, so a post's
 * .mdx file stays pure prose — no className soup, no per-file imports.
 *
 * Prose and figures share one width, so text runs flush to the same edges the
 * charts do — the way a markdown file reads on GitHub.
 */
const PROSE = "w-full max-w-5xl";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1
        className={`${PROSE} text-4xl sm:text-5xl font-bold text-white drop-shadow-lg mt-4 mb-6`}
      >
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        className={`${PROSE} text-2xl sm:text-3xl font-semibold text-white mt-2 mb-4`}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className={`${PROSE} text-lg font-semibold text-white mt-10 mb-3`}>
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className={`${PROSE} text-white/70 leading-relaxed mb-5`}>{children}</p>
    ),
    ul: ({ children }) => (
      <ul
        className={`${PROSE} text-white/70 leading-relaxed mb-5 list-disc pl-5 space-y-2 marker:text-white/30`}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        className={`${PROSE} text-white/70 leading-relaxed mb-5 list-decimal pl-5 space-y-2 marker:text-white/30`}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="pl-1">{children}</li>,
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white transition-colors duration-200"
      >
        {children}
      </a>
    ),
    strong: ({ children }) => (
      <strong className="text-white font-semibold">{children}</strong>
    ),
    em: ({ children }) => <em className="italic text-white/80">{children}</em>,
    // The last paragraph's own bottom margin would hang below the quote's
    // final line, so it is zeroed and the quote ends where the text does.
    blockquote: ({ children }) => (
      <blockquote
        className={`${PROSE} border-l-2 border-white/25 pl-5 text-white/60 italic mb-5 [&>p:last-child]:mb-0`}
      >
        {children}
      </blockquote>
    ),
    code: ({ children }) => (
      <code className="rounded bg-white/10 px-1.5 py-0.5 text-[0.9em] text-white/85">
        {children}
      </code>
    ),
    hr: () => <hr className={`${PROSE} border-white/15 my-12`} />,

    // Markdown images. A plain <img> rather than next/image: markdown gives no
    // intrinsic dimensions, and these are already sized for the column.
    img: ({ src, alt }) => (
      <img
        src={typeof src === "string" ? src : undefined}
        alt={alt ?? ""}
        loading="lazy"
        className={`${PROSE} block mx-auto h-auto rounded-2xl border border-white/20 mb-2`}
      />
    ),

    // GFM tables. The wrapper scrolls on its own so a wide table never makes
    // the page scroll sideways.
    table: ({ children }) => (
      <div className={`${PROSE} overflow-x-auto mb-8`}>
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="border-b border-white/25">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-white/10">{children}</tbody>
    ),
    tr: ({ children }) => <tr className="align-top">{children}</tr>,
    th: ({ children }) => (
      <th className="py-3 pr-6 font-semibold text-white">{children}</th>
    ),
    td: ({ children }) => (
      <td className="py-3 pr-6 text-white/70 leading-relaxed">{children}</td>
    ),

    // Figures, available in every post without an import.
    MindStateFigure,
    ProfilePlot,
    ApproachesFigure,

    ...components,
  };
}
