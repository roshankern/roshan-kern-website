import { type JSX, type ReactNode } from "react";
import type { Metadata } from "next";
import { CaptureFrame, CompareSlider } from "./compare-slider";
import { LatticeHero } from "./lattice";
import { PortraitLattice } from "./portrait-lattice";
import { ContactDetails } from "./contact-details";

/**
 * Share card. Without this the page falls back to the root layout's metadata,
 * which describes the site as a whole rather than AnyDerm.
 *
 * The image is a still of the figure at the top of this page, at scroll 0 — the
 * rig resting its lens on her cheek, white outline and all. It is rendered from
 * the page itself rather than drawn separately, so it cannot drift out of step
 * with the lattice; ./anyderm-lattice.md says how to make it again.
 *
 * `openGraph` and `twitter` are not deep-merged with the root's, so everything
 * the card needs is spelled out here, including what the root already sets.
 */
const CARD = {
	title: "AnyDerm",
	description:
		"The world’s first personal health robot. Hyper-personalized diagnosis and treatment for acne, based in science.",
	images: [
		{
			url: "/anyderm/card.png",
			width: 1200,
			height: 630,
			alt: "A robot arm holding a phone rests its lens against a woman’s cheek, drawn as a lattice of black dots on white",
		},
	],
};

// The root layout sets a plain `title` with no template today, but `absolute`
// says so explicitly: this page's tab title is exactly "AnyDerm", and stays
// that way even if a site-wide title template is added later.
export const metadata: Metadata = {
	title: { absolute: "AnyDerm" },
	description: CARD.description,
	openGraph: { ...CARD, type: "website", siteName: "AnyDerm", locale: "en_US" },
	twitter: { ...CARD, card: "summary_large_image" },
};

/** Every capture sits in the same square frame — see FRAME in ./compare-slider. */
const MEDIA_GRID = "mx-auto mt-14 grid max-w-4xl items-start gap-6 sm:grid-cols-2";

/** Sections in page order. Optional slots are omitted where nothing is set yet. */
const SECTIONS: ReadonlyArray<{
	id: string;
	heading: string;
	/** Sits between the heading and the body copy. */
	lede?: ReactNode;
	/** One paragraph, or several rendered in order. */
	body?: string | readonly string[];
	media?: ReactNode;
}> = [
	{
		id: "your-skin-your-story",
		heading: "Your skin, your story",
		body: [
			"Everyone uses skincare products, but nobody knows what’s actually working. Skin is personal, but skincare products aren’t. AnyDerm ends that.",
			"The robot uses your smartphone camera and a rental model to drastically reduce the price of next-gen healthcare. Use it to figure out the skincare routine that works best for you, then pass it on to the next person.",
		],
	},
	{
		id: "now-in-high-definition",
		heading: "Now in high definition",
		// 100× is a round figure spanning the two baselines the sentence names, both
		// measured against the 5 µm/px targeted-dermoscopy tier that is AnyDerm's
		// honest resolving limit. Arm's length: the ~100 µm the naked eye resolves at
		// its 25 cm near point scales to ~240 µm at 60 cm, so ~50×. A webcam is worse
		// — ~360 µm/px at that distance before lens softness and compression, so
		// ~150×. 100× sits between them and stays conservative for the webcam case.
		body: "The typical dermatologist looks at acne at arm’s length or over a webcam. AnyDerm has 100× this magnification to measure the subtle details of each follicle.",
		// Ordinary-light captures only — the point here is sheer detail, not modality.
		media: (
			<div className={MEDIA_GRID}>
				<CaptureFrame
					src="/anyderm/uv-visible.webp"
					alt="Skin lesion under ordinary visible light, magnified far enough to resolve individual vellus hairs and follicular openings"
				/>
				<CaptureFrame
					src="/anyderm/mole-nonpolarized.webp"
					alt="A pigmented mole under non-polarized light, magnified to show its border and surface texture"
				/>
			</div>
		),
	},
	{
		id: "see-with-superpowers",
		heading: "See with superpowers",
		body: "AnyDerm finds what your skin is hiding with different types of imaging. Each modality reveals something unique about your skin.",
		media: (
			<div className={MEDIA_GRID}>
				<CompareSlider
					left={{
						src: "/anyderm/uv-visible.webp",
						alt: "The same skin under ordinary visible light",
						label: "Visible",
					}}
					right={{
						src: "/anyderm/uv-fluorescence.webp",
						alt: "The same skin under ultraviolet excitation, where sebum and porphyrins fluoresce",
						label: "UV",
					}}
					caption="Pigment and oil fluoresce under UV light, surfacing sebum and porphyrin patterns."
				/>
				<CompareSlider
					left={{
						src: "/anyderm/mole-nonpolarized.webp",
						alt: "The same mole under non-polarized light, with surface glare intact",
						label: "Non-polarized",
					}}
					right={{
						src: "/anyderm/mole-polarized.webp",
						alt: "A mole under cross-polarized light, with surface glare removed to expose pigment and vasculature",
						label: "Polarized",
					}}
					caption="Polarized light reduces surface glare to clearly show texture, pores, and vascularity."
				/>
			</div>
		),
	},
	{
		id: "invite-only-preorders",
		heading: "Invite-only preorders",
		lede: (
			<>
				<p className="mt-8 flex items-baseline justify-center gap-5 text-2xl font-semibold tracking-tight sm:text-3xl">
					<span>$50/month</span>
					<span className="text-black/40 line-through">$100/month</span>
				</p>
				<p className="mx-auto mt-4 text-center text-base">
					Discounted pricing for preorders. Limit 3 months.
				</p>
			</>
		),
		body: "AnyDerm is currently in private beta. To receive a unit for testing, please contact the team below.",
	},
	{
		id: "contact-the-team",
		heading: "Contact the team",
		body: "Reach out to Roshan to learn more about the private beta. We are flexible with pricing and want to work closely with beta testers to make the best possible product.",
		media: (
			<ContactDetails
				details={[
					{ label: "Text", value: "720-768-9499" },
					{ label: "Email", value: "roshan.kern@gmail.com" },
				]}
			/>
		),
	},
];

/** The closing note, set under the portrait it belongs to. */
const QUOTE =
	"I remember wanting to skip class because I couldn’t imagine showing my latest outbreak to my peers. " +
	"Things got so bad I would avoid looking in any mirrors for fear of making " +
	"my insecurity worse. For months, it felt like my dermatologist was barely interested in my acne and was " +
	"guessing at my skincare routine. I don’t want anyone else to go through that. And with access to " +
	"world-class skincare, no one else will.";

export default function AnyDermPage(): JSX.Element {
	return (
		// `isolate` keeps the lattice canvas (fixed, -z-10) above the layout's white
		// ground but behind every section on the page.
		<main className="relative isolate flex flex-col">
			{/* The rig comes apart over its own runway before the page proper starts. */}
			<LatticeHero />

			{/* Wordmark and its positioning line hold the first full screen. */}
			<section className="flex min-h-dvh flex-col items-center justify-center px-6">
				{/* The lattice wordmark assembles onto this exact box and hides the
				    glyphs once it is ready — see ./lattice.tsx. Without JS the real
				    text stays visible. */}
				<h1 id="anyderm-wordmark" className="text-center text-6xl font-semibold tracking-tight sm:text-8xl">
					AnyDerm
				</h1>
				<p className="mt-8 max-w-2xl text-center text-lg leading-relaxed sm:text-xl">
					The world’s first personal health robot. AnyDerm gives hyper-personalized diagnosis and treatment
					for acne based in science.
				</p>
			</section>

			{SECTIONS.map(({ id, heading, lede, body, media }) => (
				<section key={id} id={id} className="px-6 py-14 sm:py-20">
					<h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">{heading}</h2>
					{lede}
					{(typeof body === "string" ? [body] : body ?? []).map((para) => (
						<p key={para} className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed sm:text-xl">
							{para}
						</p>
					))}
					{media}
				</section>
			))}

			{/* Closing figure: dots gather in from the page edges and settle into
			    the portrait — the break-up at the top of the page, run backwards. The
			    gathering finishes with the face centred, so the quote below it is
			    already coming up from the bottom edge as the last dot lands. */}
			<PortraitLattice />

			{/* Why any of this exists, in Roshan's own words. It sits under the
			    portrait deliberately: the face and the voice are one closing block. */}
			<section id="roshans-story" className="px-6 pb-12 pt-2 sm:pb-16">
				<figure className="mx-auto max-w-2xl">
					{/* Set exactly like the body copy elsewhere on the page — the italic
					    attribution is the only thing marking it as a quote. */}
					<blockquote className="text-center text-lg leading-relaxed sm:text-xl">
						<p>{QUOTE}</p>
					</blockquote>
					<figcaption className="mt-8 text-center text-lg italic leading-relaxed sm:text-xl">
						- Roshan Kern
					</figcaption>
				</figure>
			</section>
		</main>
	);
}
