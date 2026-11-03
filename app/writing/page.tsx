import Link from "next/link";
import type { Metadata } from "next";
import { formatDate, postsByDate } from "./posts";

export const metadata: Metadata = {
  title: "Writing",
  description: "Essays by Roshan Kern.",
};

export default function WritingIndexPage() {
  const posts = postsByDate();

  return (
    <div className="w-full max-w-2xl">
      <h1 className="mb-10 text-3xl font-semibold tracking-tight sm:text-4xl">Writing</h1>

      <ul className="flex flex-col">
        {posts.map((post) => (
          <li key={post.slug} className="border-t border-black/10">
            <Link
              href={`/writing/${post.slug}`}
              className="group flex flex-col py-5 sm:flex-row sm:items-baseline sm:gap-6"
            >
              <time dateTime={post.date} className="shrink-0 text-sm tabular-nums text-black/40 sm:w-40">
                {formatDate(post.date)}
              </time>
              <span className="text-lg text-black/80 transition-colors duration-200 group-hover:text-black">
                {post.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
