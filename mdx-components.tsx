import type { MDXComponents } from "mdx/types";
import MindStateFigure from "./app/components/MindStateFigure";
import ProfilePlot from "./app/components/ProfilePlot";
import ApproachesFigure from "./app/components/ApproachesFigure";
import StitchFigure from "./app/components/StitchFigure";
import FableAcneProgression from "./app/components/fable-skin/FableAcneProgression";
import RobotScanFigure from "./app/components/robot-scan/RobotScanFigure";

/**
 * Every markdown element gets its styling here, once, so a post's .mdx file
 * stays pure prose — no className soup, no per-file imports. Black on white in
 * the home page's Figtree, like the rest of the site.
 *
 * Prose runs in a readable measure; figures (and tables, which need the room)
 * take the article's full width.
 */
const PROSE = "w-full max-w-2xl";
const WIDE = "w-full max-w-5xl";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className={`${PROSE} text-3xl sm:text-4xl font-semibold tracking-tight mt-4 mb-8`}>
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className={`${PROSE} text-2xl font-semibold tracking-tight mt-12 mb-4`}>
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className={`${PROSE} text-lg font-semibold mt-10 mb-3`}>{children}</h3>
    ),
    p: ({ children }) => (
      <p className={`${PROSE} text-lg text-black/75 leading-relaxed mb-5`}>{children}</p>
    ),
    ul: ({ children }) => (
      <ul
        className={`${PROSE} text-lg text-black/75 leading-relaxed mb-5 list-disc pl-5 space-y-2 marker:text-black/30`}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        className={`${PROSE} text-lg text-black/75 leading-relaxed mb-5 list-decimal pl-5 space-y-2 marker:text-black/30`}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="pl-1">{children}</li>,
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-black underline decoration-black/25 underline-offset-4 hover:decoration-black transition-colors duration-200"
      >
        {children}
      </a>
    ),
    strong: ({ children }) => (
      <strong className="text-black font-semibold">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    // The last paragraph's own bottom margin would hang below the quote's
    // final line, so it is zeroed and the quote ends where the text does.
    blockquote: ({ children }) => (
      <blockquote
        className={`${PROSE} border-l-2 border-black/15 pl-5 text-black/60 italic mb-5 [&>p:last-child]:mb-0`}
      >
        {children}
      </blockquote>
    ),
    code: ({ children }) => (
      <code className="rounded bg-black/[0.05] px-1.5 py-0.5 text-[0.9em] text-black/85">
        {children}
      </code>
    ),
    hr: () => <hr className={`${PROSE} border-black/10 my-12`} />,

    // Markdown images. A plain <img> rather than next/image: markdown gives no
    // intrinsic dimensions, and these are already sized for the column.
    img: ({ src, alt }) => (
      <img
        src={typeof src === "string" ? src : undefined}
        alt={alt ?? ""}
        loading="lazy"
        className={`${WIDE} block mx-auto h-auto rounded-2xl border border-black/10 mb-2`}
      />
    ),

    // GFM tables. The wrapper scrolls on its own so a wide table never makes
    // the page scroll sideways.
    table: ({ children }) => (
      <div className={`${WIDE} overflow-x-auto mb-8`}>
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="border-b border-black/20">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-black/10">{children}</tbody>
    ),
    tr: ({ children }) => <tr className="align-top">{children}</tr>,
    th: ({ children }) => (
      <th className="py-3 pr-6 font-semibold text-black">{children}</th>
    ),
    td: ({ children }) => (
      <td className="py-3 pr-6 text-black/70 leading-relaxed">{children}</td>
    ),

    // Figures, available in every post without an import.
    MindStateFigure,
    ProfilePlot,
    ApproachesFigure,
    StitchFigure,
    FableAcneProgression,
    RobotScanFigure,

    ...components,
  };
}
