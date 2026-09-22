"use client";

import Image from "next/image";
import {
	useCallback,
	useRef,
	useState,
	type CSSProperties,
	type JSX,
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
} from "react";

/** Square box shared by every capture on this page. No border — see EDGE_FADE. */
export const FRAME = "relative aspect-square w-full max-w-md";

/** The masked layer inside FRAME that actually holds the imagery. */
const MEDIA = "absolute inset-0 overflow-hidden rounded-2xl";

/**
 * Dissolves the capture into the white page instead of stopping it at a border.
 *
 * Two axis gradients intersected, so all four edges fade by the same narrow amount —
 * a single radial gradient would pull the corners in as an oval. The -webkit-
 * pair covers Safari before it took the standard `mask-composite`.
 */
const FADE = "linear-gradient(to right, transparent, #000 2.5%, #000 97.5%, transparent)";
const FADE_Y = "linear-gradient(to bottom, transparent, #000 2.5%, #000 97.5%, transparent)";
const EDGE_FADE: CSSProperties = {
	maskImage: `${FADE}, ${FADE_Y}`,
	maskComposite: "intersect",
	WebkitMaskImage: `${FADE}, ${FADE_Y}`,
	WebkitMaskComposite: "source-in",
};

/**
 * The same dissolve on the label plate. Stops are in pixels rather than percent
 * because the plate is small — a percentage fade would be a couple of pixels
 * wide horizontally and swallow the cap height vertically.
 */
const PLATE_FADE = "linear-gradient(to right, transparent, #000 12px, #000 calc(100% - 12px), transparent)";
const PLATE_FADE_Y = "linear-gradient(to bottom, transparent, #000 7px, #000 calc(100% - 7px), transparent)";
const PLATE_EDGE_FADE: CSSProperties = {
	maskImage: `${PLATE_FADE}, ${PLATE_FADE_Y}`,
	maskComposite: "intersect",
	WebkitMaskImage: `${PLATE_FADE}, ${PLATE_FADE_Y}`,
	WebkitMaskComposite: "source-in",
};

/** Both images fill the square frame identically, so they stay pixel-aligned. */
const IMAGE_SIZES = "(min-width: 640px) 28rem, 100vw";

/** Half the 36px puck — how far the divider stays clear of either edge. */
const HANDLE_RADIUS_PX = 18;

type Pane = {
	src: string;
	alt: string;
	/** Short caption pinned to that side of the divider. */
	label: string;
};

/**
 * Set like body copy — same face, same sentence case, just smaller. The plate is
 * white with black text and its own dissolving edge, and it sits *under* the
 * imagery, so sliding an image across it covers it rather than fighting it.
 */
const LABEL = "pointer-events-none absolute top-3 bg-white/55 px-4 py-2.5 text-sm text-black";

/**
 * Drag-to-reveal comparison of two registered captures of the same skin.
 *
 * Monochrome by design: the page is strict black-on-white, so the divider,
 * handle and labels carry no accent colour.
 */
export function CompareSlider({
	left,
	right,
	caption,
}: {
	left: Pane;
	right: Pane;
	/** Optional note on what the modality reveals, set under the frame. */
	caption?: string;
}): JSX.Element {
	const frameRef = useRef<HTMLDivElement>(null);
	const [pct, setPct] = useState(50);
	const [dragging, setDragging] = useState(false);

	/**
	 * Keeps the puck a half-width clear of both edges, so it never sits half
	 * off the frame. The inset is recomputed per call because the frame is
	 * fluid below its max width.
	 */
	const clampPct = useCallback((value: number): number => {
		const width = frameRef.current?.getBoundingClientRect().width ?? 0;
		const inset = width > 0 ? (HANDLE_RADIUS_PX / width) * 100 : 0;
		return Math.min(100 - inset, Math.max(inset, value));
	}, []);

	const setFromClientX = useCallback(
		(clientX: number) => {
			const rect = frameRef.current?.getBoundingClientRect();
			if (!rect || rect.width === 0) return;
			setPct(clampPct(((clientX - rect.left) / rect.width) * 100));
		},
		[clampPct],
	);

	const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
		e.currentTarget.setPointerCapture(e.pointerId);
		setDragging(true);
		setFromClientX(e.clientX);
	};

	const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
		if (dragging) setFromClientX(e.clientX);
	};

	const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
		if (e.currentTarget.hasPointerCapture(e.pointerId)) {
			e.currentTarget.releasePointerCapture(e.pointerId);
		}
		setDragging(false);
	};

	const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
		const step = e.shiftKey ? 10 : 2;
		const moves: Record<string, () => number> = {
			ArrowLeft: () => pct - step,
			ArrowRight: () => pct + step,
			Home: () => 0,
			End: () => 100,
		};
		const move = moves[e.key];
		if (!move) return;
		e.preventDefault();
		setPct(clampPct(move()));
	};

	return (
		<figure className="m-0 mx-auto max-w-md">
			<div
				ref={frameRef}
				// touch-pan-y keeps vertical page scrolling alive while the
				// horizontal drag is captured here.
				className={`${FRAME} mx-auto touch-pan-y select-none`}
				style={{ cursor: dragging ? "grabbing" : "ew-resize" }}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
			>
				{/* Only the imagery is masked; the chrome below stays crisp. */}
				<div className={MEDIA} style={EDGE_FADE}>
					<Image
						src={right.src}
						alt={right.alt}
						fill
						sizes={IMAGE_SIZES}
						className="pointer-events-none object-cover"
						draggable={false}
					/>

					{/* Sits above the base image but below the clipped layer, so dragging
					    the left image rightwards buries it. */}
					<span className={`${LABEL} right-3`} style={PLATE_EDGE_FADE}>
						{right.label}
					</span>

					{/* clip-path hides the right of this copy without resizing it, so both
				    images stay pixel-aligned as the divider moves. The left label rides
				    inside the clip, so it is revealed and hidden with its own image. */}
					<div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
						<Image
							src={left.src}
							alt={left.alt}
							fill
							sizes={IMAGE_SIZES}
							className="pointer-events-none object-cover"
							draggable={false}
						/>
						<span className={`${LABEL} left-3`} style={PLATE_EDGE_FADE}>
							{left.label}
						</span>
					</div>
				</div>

				{/* Divider and handle. White line, white puck, black glyph — the
			    monochrome inversion of the gold-on-dark reference. */}
				<div
					className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-white"
					style={{ left: `${pct}%` }}
				/>

				<div
					role="slider"
					tabIndex={0}
					aria-label={`Reveal ${left.label} or ${right.label}`}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(pct)}
					aria-valuetext={`${Math.round(pct)}% ${left.label}`}
					onKeyDown={onKeyDown}
					className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-bold text-black focus:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
					style={{ left: `${pct}%` }}
				>
					<span aria-hidden="true">⇆</span>
				</div>
			</div>
			{caption ? (
				<figcaption className="mt-4 text-center text-sm italic leading-relaxed">{caption}</figcaption>
			) : null}
		</figure>
	);
}

/** A single capture in the same square frame as the sliders. */
export function CaptureFrame({ src, alt }: { src: string; alt: string }): JSX.Element {
	return (
		<div className={`${FRAME} mx-auto`}>
			<div className={MEDIA} style={EDGE_FADE}>
				<Image src={src} alt={alt} fill sizes={IMAGE_SIZES} className="object-cover" />
			</div>
		</div>
	);
}
