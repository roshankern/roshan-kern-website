'use client';
import {useLayoutEffect, useMemo, useRef, type CSSProperties, type RefObject} from 'react';
import {anchorFor, anchorKey, issueColor, type Anchor} from './anchors';
import type {Issue} from './types';
import './issue-dots.css';

/** Called by the scene's render loop. `project` returns the anchor's CSS-pixel position in the
 *  canvas and its zoom `scale` (1 = the body centre in the default fitted view), or null while
 *  geometry is loading, when the point is behind the camera, or when its system is hidden. */
export interface DotsHandle {
	stale: boolean;
	place(project: (key: string, anchor: Anchor) => {x: number; y: number; scale: number} | null): void;
}

interface Props {
	issues: Issue[];
	selectedIssue: string | null;
	onSelectIssue: (id: string | null) => void;
	handle: RefObject<DotsHandle | null>;
}

/** Dot diameter in CSS pixels: 2.5 at the default fitted view, then scaling with the 3D zoom. */
const BASE_SIZE = 2.5, MIN_SIZE = 1.5, MAX_SIZE = 5;
/** Minimum centre-to-centre distance between dots, as a multiple of their diameter. */
const GAP = 1.35;

/** Issues sharing an anchor fan out in a small screen-space ring, in units of the dot diameter. */
function fan(n: number) {
	if (n < 2) return [{dx: 0, dy: 0}];
	const r = Math.max(1.1, (GAP / 2) / Math.sin(Math.PI / n));
	return Array.from({length: n}, (_, k) => {
		const a = -Math.PI / 2 + (k / n) * Math.PI * 2;
		return {dx: Math.cos(a) * r, dy: Math.sin(a) * r};
	});
}

export default function IssueDots({issues, selectedIssue, onSelectIssue, handle}: Props) {
	const els = useRef(new Map<string, HTMLButtonElement>());
	const groups = useMemo(() => {
		const byKey = new Map<string, {anchor: Anchor; ids: string[]}>();
		[...issues].sort((a, b) => a.date.localeCompare(b.date)).forEach(issue => {
			const anchor = anchorFor(issue), key = anchorKey(anchor);
			const g = byKey.get(key) ?? {anchor, ids: []};
			g.ids.push(issue.id);
			byKey.set(key, g);
		});
		return [...byKey].map(([key, {anchor, ids}]) => {
			const offsets = fan(ids.length);
			return {key, anchor, members: ids.map((id, k) => ({id, ...offsets[k]}))};
		});
	}, [issues]);

	// Positions are written straight to the DOM each time the camera moves: no React render per frame.
	useLayoutEffect(() => {
		handle.current = {
			stale: true,
			place(project) {
				const shown: {el: HTMLButtonElement; x: number; y: number; size: number}[] = [];
				for (const g of groups) {
					const p = project(g.key, g.anchor);
					const size = p ? Math.min(MAX_SIZE, Math.max(MIN_SIZE, BASE_SIZE * p.scale)) : 0;
					for (const m of g.members) {
						const el = els.current.get(m.id);
						if (!el) continue;
						if (!p) el.style.visibility = 'hidden';
						else shown.push({el, x: p.x + m.dx * size, y: p.y + m.dy * size, size});
					}
				}
				// Neighbouring anchors (face, throat) can crowd together: nudge dots apart until none overlap,
				// the gap scaling with dot size so small dots stay close to their true anchors.
				for (let pass = 0; pass < 12; pass++) {
					let moved = false;
					for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
						const a = shown[i], b = shown[j], gap = (a.size + b.size) / 2 * GAP;
						let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
						if (d >= gap) continue;
						if (d < 1e-3) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
						const push = (gap - d) / 2 / d;
						a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
						moved = true;
					}
					if (!moved) break;
				}
				for (const {el, x, y, size} of shown) {
					el.style.visibility = 'visible';
					el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
					el.style.setProperty('--dot-size', `${size.toFixed(1)}px`);
				}
				this.stale = false;
			},
		};
		return () => { handle.current = null; };
	}, [groups, handle]);

	const stop = (e: {stopPropagation(): void}) => e.stopPropagation();
	return (
		<div className="issue-dots">
			{issues.map(issue => {
				const selected = issue.id === selectedIssue;
				return (
					<button
						key={issue.id}
						type="button"
						ref={el => { if (el) els.current.set(issue.id, el); else els.current.delete(issue.id); }}
						className={`issue-dot${selected ? ' is-selected' : ''}`}
						style={{'--dot-color': issueColor(issue)} as CSSProperties}
						aria-label={issue.title}
						aria-pressed={selected}
						onPointerDown={stop}
						onDoubleClick={stop}
						onWheel={stop}
						onClick={() => onSelectIssue(selected ? null : issue.id)}
					>
						<i className="issue-dot-mark" />
						<span className="issue-dot-tip" aria-hidden="true">{issue.title}<small>{issue.date.slice(0, 4)}</small></span>
					</button>
				);
			})}
		</div>
	);
}
