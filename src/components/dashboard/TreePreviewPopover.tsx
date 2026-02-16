import { useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface TreePreviewPopoverProps {
	conversationId: string;
	children: React.ReactNode;
}

interface TreeNode {
	_id: string;
	parentId?: string;
	depth: number;
}

function renderMiniTree(
	canvas: HTMLCanvasElement,
	nodes: TreeNode[],
) {
	const ctx = canvas.getContext("2d");
	if (!ctx || nodes.length === 0) return;

	const dpr = window.devicePixelRatio || 1;
	const w = canvas.width / dpr;
	const h = canvas.height / dpr;

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.scale(dpr, dpr);

	// Build adjacency map
	const childrenMap = new Map<string | "root", string[]>();
	childrenMap.set("root", []);
	for (const node of nodes) {
		const parentKey = node.parentId ?? "root";
		if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
		childrenMap.get(parentKey)!.push(node._id);
	}

	// Assign positions via BFS
	const positions = new Map<string, { x: number; y: number }>();
	const nodeRadius = 3;
	const levelGap = 14;
	const siblingGap = 12;

	type QueueItem = { id: string; depth: number; xCenter: number };
	const queue: QueueItem[] = [];

	const roots = childrenMap.get("root") ?? [];
	const totalRootWidth = roots.length * siblingGap;
	const rootStartX = (w - totalRootWidth) / 2 + siblingGap / 2;

	for (let i = 0; i < roots.length; i++) {
		queue.push({ id: roots[i], depth: 0, xCenter: rootStartX + i * siblingGap });
	}

	let qi = 0;
	while (qi < queue.length) {
		const { id, depth, xCenter } = queue[qi++];
		const y = 10 + depth * levelGap;
		positions.set(id, { x: xCenter, y });

		const children = childrenMap.get(id) ?? [];
		const totalChildWidth = children.length * siblingGap;
		const childStartX = xCenter - totalChildWidth / 2 + siblingGap / 2;

		for (let i = 0; i < children.length; i++) {
			queue.push({
				id: children[i],
				depth: depth + 1,
				xCenter: childStartX + i * siblingGap,
			});
		}
	}

	// Draw edges
	ctx.strokeStyle = "rgba(196, 100, 42, 0.3)";
	ctx.lineWidth = 1;
	for (const node of nodes) {
		if (!node.parentId) continue;
		const from = positions.get(node.parentId);
		const to = positions.get(node._id);
		if (from && to) {
			ctx.beginPath();
			ctx.moveTo(from.x, from.y);
			ctx.lineTo(to.x, to.y);
			ctx.stroke();
		}
	}

	// Draw nodes
	for (const node of nodes) {
		const pos = positions.get(node._id);
		if (!pos) continue;
		ctx.beginPath();
		ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
		ctx.fillStyle = node.depth === 0 ? "#c4642a" : "rgba(196, 100, 42, 0.6)";
		ctx.fill();
	}

	ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function TreePreviewPopover({
	conversationId,
	children,
}: TreePreviewPopoverProps) {
	const [showPreview, setShowPreview] = useState(false);
	const [shouldFetch, setShouldFetch] = useState(false);
	const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const treeData = useQuery(
		api.dashboard.getConversationTreeStructure,
		shouldFetch
			? { conversationId: conversationId as Id<"conversations"> }
			: "skip",
	);

	const handleMouseEnter = useCallback(() => {
		hoverTimerRef.current = setTimeout(() => {
			setShouldFetch(true);
			setShowPreview(true);
		}, 300);
	}, []);

	const handleMouseLeave = useCallback(() => {
		if (hoverTimerRef.current) {
			clearTimeout(hoverTimerRef.current);
			hoverTimerRef.current = null;
		}
		setShowPreview(false);
	}, []);

	useEffect(() => {
		if (showPreview && treeData && canvasRef.current) {
			const canvas = canvasRef.current;
			const dpr = window.devicePixelRatio || 1;
			canvas.width = 160 * dpr;
			canvas.height = 120 * dpr;
			canvas.style.width = "160px";
			canvas.style.height = "120px";
			renderMiniTree(canvas, treeData as TreeNode[]);
		}
	}, [showPreview, treeData]);

	useEffect(() => {
		return () => {
			if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
		};
	}, []);

	return (
		<div
			className="relative"
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			{children}
			{showPreview && (
				<div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-lg bg-[var(--db-bg)] border border-[var(--db-border)] shadow-lg pointer-events-none">
					{treeData && treeData.length > 0 ? (
						<canvas ref={canvasRef} className="block" />
					) : (
						<div className="w-40 h-[120px] flex items-center justify-center">
							<span className="text-xs text-[var(--db-text-tertiary)]">
								{treeData ? "No nodes yet" : "Loading..."}
							</span>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
