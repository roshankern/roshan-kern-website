import { type ReactNode, type JSX } from "react";
import { Figtree } from "next/font/google";

/**
 * AnyDerm layout.
 *
 * Three things are scoped to this route and deliberately do NOT leak to the
 * rest of the site:
 *
 *  1. Typeface. OpenAI Sans is OpenAI's proprietary in-house typeface and is not
 *     licensed for third-party use, so we use the closest freely-licensed match:
 *     Figtree, a geometric sans with the same rounded, high-aperture forms.
 *     It is the only font used on this page.
 *  2. Theme. AnyDerm is plain white with black text, so the style block below
 *     pins <body> to exactly that (and flips color-scheme so scrollbars and
 *     controls render light) only while this layout is mounted, rather than
 *     inheriting whatever the root layout happens to leave unset.
 *  3. Scroll behavior. The same block pins `scroll-behavior:auto`, which the
 *     scroll-driven lattice figure needs — see ./lattice.tsx.
 */
const figtree = Figtree({
	subsets: ["latin"],
	display: "swap",
	weight: ["400", "500", "600", "700"],
});

export default function AnyDermLayout({ children }: { children: ReactNode }): JSX.Element {
	return (
		<>
			{/* `scroll-behavior:auto` is defensive: this site's globals.css does not
			    turn on smooth scroll today, but the lattice figure is driven directly
			    off scrollY, and an animated programmatic scroll would desynchronise it
			    from the frame being drawn. Pinning it here keeps the figure correct no
			    matter what the global stylesheet grows into. */}
			<style>{`html{color-scheme:light;scroll-behavior:auto}body{background-color:#fff;color:#000}`}</style>
			{/* `min-h-dvh` is what actually fills the viewport here: the root layout's
			    <body> is not a flex column, so `flex-1` alone would collapse to content
			    height. `flex-1` is kept so this still fills correctly if <body> ever
			    does become `flex min-h-dvh flex-col`. */}
			<div className={`${figtree.className} min-h-dvh flex-1 bg-white text-black`}>{children}</div>
		</>
	);
}
