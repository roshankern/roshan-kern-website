import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  // .mdx files are routable pages, so a post can be a markdown file.
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
};

const withMDX = createMDX({
  options: {
    // GitHub-Flavored Markdown: tables, strikethrough, task lists, autolinks.
    // Named as a string because Turbopack serializes this config and cannot
    // carry an imported function across the boundary.
    remarkPlugins: [["remark-gfm"]],
  },
});

export default withMDX(nextConfig);
