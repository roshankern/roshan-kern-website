import Link from "next/link";
import type { Metadata } from "next";
import GlassBackground from "../components/GlassBackground";
import { formatDate, postsByDate } from "./posts";

export const metadata: Metadata = {
  title: "Writing",
  description: "Essays by Roshan Kern.",
};

export default function WritingIndexPage() {
  const posts = postsByDate();

  return (
    <>
      {/* Same wash as the homepage. */}
      <GlassBackground />

      <div className="relative z-10 w-full max-w-5xl">
        <h1 className="text-4xl sm:text-5xl font-bold text-white drop-shadow-lg mb-10">
          Writing
        </h1>

        <ul className="flex flex-col">
          {posts.map((post) => (
            <li key={post.slug} className="border-t border-white/15">
              <Link
                href={`/writing/${post.slug}`}
                className="group flex flex-col sm:flex-row sm:items-baseline sm:gap-6 py-5"
              >
                <time
                  dateTime={post.date}
                  className="shrink-0 text-sm text-white/40 tabular-nums sm:w-40"
                >
                  {formatDate(post.date)}
                </time>
                <span className="text-lg text-white/80 group-hover:text-white transition-colors duration-200">
                  {post.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
