import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  // .mdx files are routable pages, so a post can be a markdown file.
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  // `next build` wipes and rewrites the output directory. If it shares one with
  // a running `next dev`, the dev server's static/development folder vanishes
  // underneath it and every request 500s on a missing _buildManifest. Giving dev
  // its own directory makes the two safe to run at once. Build, start, and the
  // Netlify deploy keep using .next exactly as before.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

const withMDX = createMDX({
  // Default is /\.mdx$/, which leaves plain .md pages with no loader and makes
  // Turbopack panic on them. Research notes are routed as .md, so match both.
  extension: /\.mdx?$/,
  options: {
    // GitHub-Flavored Markdown: tables, strikethrough, task lists, autolinks.
    // Named as a string because Turbopack serializes this config and cannot
    // carry an imported function across the boundary.
    remarkPlugins: [["remark-gfm"]],
  },
});

export default withMDX(nextConfig);
