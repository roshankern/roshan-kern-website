import { type JSX } from "react";
import type { Metadata } from "next";
import AtlasApp from "../atlas/atlas-app";

/**
 * AnyHealth test: the /anyhealth viewer with the 2009 left humerus fracture drawn on the
 * skeleton, healing as the timeline moves (see app/anyhealth/fracture). Not indexed.
 */
export const metadata: Metadata = {
	title: { absolute: "AnyHealth · test" },
	description: "An interactive viewer for my health.",
	robots: { index: false, follow: false },
};

export default function AnyHealthTestPage(): JSX.Element {
	return <AtlasApp fracture />;
}
