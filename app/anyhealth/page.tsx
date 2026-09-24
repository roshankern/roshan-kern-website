import { type JSX } from "react";
import type { Metadata } from "next";
import AtlasApp from "./atlas/atlas-app";

/**
 * AnyHealth: an interactive viewer for my health record.
 *
 * The Human Atlas viewer (github.com/ashemag/human-atlas, MIT; BodyParts3D
 * anatomy, CC BY 4.0), ported into ./atlas with its geometry re-encoded by
 * scripts/encode-anyhealth-atlas.mjs, with my health issues from the private
 * roshan-health repo (scripts/sync-anyhealth-health.mjs) in ./health.
 */
export const metadata: Metadata = {
	title: { absolute: "AnyHealth" },
	description: "An interactive viewer for my health.",
};

export default function AnyHealthPage(): JSX.Element {
	return <AtlasApp />;
}
