import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SECTIONS, type Item, type Section } from "../cv";

/*
 * The CV sections below the hero: a label per section, then one item per line
 * (title and date, summary under it). Items with more to say open with a native
 * <details>, so expanding needs no script.
 */

const canExpand = (i: Item) => Boolean(i.details?.length || i.links?.length);

function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 text-black/30 transition-transform group-open:rotate-180 ${className}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** A detail line, with each markdown-style [text](url) in it as a link. */
function withLinks(text: string) {
  // split with a capturing regex: text, label, url, text, label, url, ..., text
  const parts = text.split(/\[([^\]]+)\]\(([^)]+)\)/);
  return parts.map((p, k) =>
    k % 3 === 1 ? (
      <a key={k} href={parts[k + 1]} target="_blank" rel="noopener noreferrer" className="text-black underline decoration-black/25 underline-offset-4 hover:decoration-black">
        {p}
      </a>
    ) : k % 3 === 2 ? null : (
      p
    ),
  );
}

/** One item: `row` is always shown; the chevron in it opens the details below. */
function Entry({ item, row }: { item: Item; row: ReactNode }) {
  if (!canExpand(item)) return <div>{row}</div>;
  return (
    <details className="group">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">{row}</summary>
      <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-black/55">
        {item.details?.map((d) => <p key={d}>{withLinks(d)}</p>)}
        {item.links && (
          <p className="flex gap-4">
            {item.links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="text-black underline decoration-black/25 underline-offset-4 hover:decoration-black">
                {l.label}
              </a>
            ))}
          </p>
        )}
      </div>
    </details>
  );
}

function SectionLink({ section }: { section: Section }) {
  if (!section.link) return null;
  return (
    <a href={section.link.href} target="_blank" rel="noopener noreferrer" className="text-black/40 underline decoration-black/20 underline-offset-4 hover:text-black">
      {section.link.label}
    </a>
  );
}

export function Sections() {
  return (
    <div className="mx-auto max-w-2xl px-6 pb-32">
      {SECTIONS.map((s) => (
        <section key={s.id} className="mt-20 first:mt-0">
          <h2 className="mb-6 flex justify-between text-xs font-medium uppercase tracking-[0.14em] text-black/40">
            {s.title}
            <span className="normal-case tracking-normal"><SectionLink section={s} /></span>
          </h2>
          <div className="space-y-6">
            {s.items.map((i) => (
              <div key={i.title}>
                <Entry
                  item={i}
                  row={
                    <>
                      <div className="flex items-baseline gap-3">
                        <span className="font-medium">
                          {i.href ? (
                            <Link href={i.href} className="underline decoration-black/20 underline-offset-4 transition-colors hover:decoration-black">
                              {i.title}
                            </Link>
                          ) : (
                            i.title
                          )}
                        </span>
                        <span className="ml-auto shrink-0 text-sm tabular-nums text-black/40">{i.date}</span>
                        {canExpand(i) ? <Chevron className="self-center" /> : <span className="w-4" />}
                      </div>
                      {i.summary && <p className="mt-0.5 pr-7 text-black/55">{i.summary}</p>}
                    </>
                  }
                />
                {i.image && (
                  <Image
                    src={i.image.src}
                    alt={i.image.alt}
                    width={i.image.width}
                    height={i.image.height}
                    sizes="(min-width: 720px) 624px, 100vw"
                    className="mt-4 h-auto w-full"
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
