import { brain } from "./brain";
import { helix } from "./helix";
import { laptop } from "./laptop";
import type { Figure } from "./sweep";

/** The closing scene's stills, in the order they play. */
export const FIGURES: Figure[] = [helix, laptop, brain];
