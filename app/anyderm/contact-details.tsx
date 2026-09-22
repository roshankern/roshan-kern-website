"use client";

import { useCallback, useEffect, useRef, useState, type JSX } from "react";

type Detail = {
	/** Plain-language verb in front of the value, e.g. "Text". */
	label: string;
	value: string;
};

/**
 * Contact lines that copy themselves on click.
 *
 * One shared confirmation sits below both rows in a fixed-height live region,
 * so the reply never reflows the lines it is confirming.
 */
export function ContactDetails({ details }: { details: readonly Detail[] }): JSX.Element {
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timer.current) clearTimeout(timer.current);
		};
	}, []);

	const copy = useCallback(async (value: string) => {
		try {
			await navigator.clipboard.writeText(value);
		} catch {
			// Clipboard is unavailable (insecure origin, denied permission).
			// The value is still selectable on the page, so say nothing.
			return;
		}
		setCopied(true);
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => setCopied(false), 1800);
	}, []);

	return (
		<div className="mt-10 flex flex-col items-center gap-1">
			{details.map(({ label, value }) => (
				<p key={value} className="text-lg leading-relaxed sm:text-xl">
					{label}{" "}
					<button
						type="button"
						onClick={() => void copy(value)}
						className="text-black/50 underline-offset-4 transition-colors hover:text-black/70 hover:underline focus-visible:underline focus-visible:outline-hidden"
						aria-label={`Copy ${value} to clipboard`}
					>
						{value}
					</button>
				</p>
			))}
			{/* Fixed height reserves the line so nothing shifts when it fills. */}
			<p aria-live="polite" className="h-6 text-sm italic">
				{copied ? "Copied to clipboard!" : ""}
			</p>
		</div>
	);
}
