import { type JSX } from "react";
import type { Metadata } from "next";
import TimelineApp from "./timeline-app";

/** AnyHealth timeline: growth and every health issue animated on the atlas (see app/anyhealth/timeline). Not indexed while in progress. */
export const metadata: Metadata = {
	title: { absolute: "AnyHealth · timeline" },
	description: "My body's growth and health story, animated.",
	robots: { index: false, follow: false },
};

export default function AnyHealthTimelinePage(): JSX.Element {
	return <TimelineApp />;
}
