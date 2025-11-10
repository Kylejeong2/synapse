import {
	Background,
	MiniMap,
	type NodeTypes,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import { Maximize2, MessageSquare, Minimize2, Network } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";
import { type ConversationNode, NodeCard } from "@/components/tree/NodeCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTreeLayout } from "@/hooks/useTreeLayout";
import type { Id } from "../../../convex/_generated/dataModel";

interface FlowMiniMapProps {
	nodes: Array<{
		_id: string;
		parentId?: string;
		userPrompt: string;
		assistantResponse: string;
		tokensUsed: number;
		depth: number;
		position: { x: number; y: number };
	}>;
	conversationId: string;
	currentNodeId?: Id<"nodes">;
	onNodeClick?: (nodeId: string) => void;
}

const nodeTypes: NodeTypes = {
	conversationNode: NodeCard,
} satisfies NodeTypes;

export function FlowMiniMap({
	nodes: dbNodes,
	conversationId,
	currentNodeId,
	onNodeClick,
}: FlowMiniMapProps) {
	const [isFullscreen, setIsFullscreen] = useState(false);
	const { nodes: layoutNodes, edges: layoutEdges } = useTreeLayout(dbNodes);

	// Add conversationId and highlight current node (memoized to avoid infinite updates)
	const nodesWithData = useMemo(
		() =>
			layoutNodes.map((node) => ({
				...node,
				data: {
					...node.data,
					conversationId,
				},
				className: node.id === currentNodeId ? "ring-2 ring-primary" : "",
			})),
		[layoutNodes, conversationId, currentNodeId],
	);

	const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithData);
	const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

	// UI sync effect reacting to live-updating nodes/edges from props (Convex).
	// Not a data fetch; keep as useEffect to update ReactFlow state.
	useEffect(() => {
		setNodes(nodesWithData);
	}, [nodesWithData, setNodes]);

	// UI sync for edges; same rationale as above.
	useEffect(() => {
		setEdges(layoutEdges);
	}, [layoutEdges, setEdges]);

	const handleNodeClick = useCallback(
		(_event: React.MouseEvent, node: { id: string }) => {
			if (onNodeClick) {
				onNodeClick(node.id);
			}
		},
		[onNodeClick],
	);

	if (dbNodes.length === 0) {
		return (
			<div className="flex items-center justify-center h-full bg-muted/20">
				<div className="text-center space-y-2">
					<div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
						<MessageSquare className="h-6 w-6 text-primary" />
					</div>
					<p className="text-sm font-medium">No conversation yet</p>
					<p className="text-xs text-muted-foreground">
						Start chatting to see your conversation tree
					</p>
				</div>
			</div>
		);
	}

	const flowContent = (
		<div className="w-full h-full relative flex flex-col">
			{/* Header */}
			<div className="px-4 py-3 border-b bg-background/80 backdrop-blur-sm flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
						<Network className="h-4 w-4 text-primary" />
					</div>
					<div>
						<h3 className="text-sm font-semibold">Conversation Tree</h3>
						<p className="text-xs text-muted-foreground">
							{dbNodes.length} node{dbNodes.length !== 1 ? "s" : ""}
						</p>
					</div>
				</div>
				<Button
					variant="outline"
					size="icon"
					className="h-8 w-8"
					onClick={() => setIsFullscreen(!isFullscreen)}
				>
					<Maximize2 className="h-4 w-4" />
				</Button>
			</div>

			{/* Flow */}
			<div className="flex-1">
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onNodeClick={handleNodeClick}
					nodeTypes={nodeTypes}
					fitView
					minZoom={0.1}
					maxZoom={1.5}
					defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
					nodesDraggable={false}
					nodesConnectable={false}
					elementsSelectable={true}
				>
					<Background />
					<MiniMap
						nodeColor={(node) => {
							if (node.id === currentNodeId) return "#f97316";
							const depth =
								(node.data as unknown as ConversationNode["data"])?.depth ?? 0;
							if (depth === 0) return "#f97316";
							if (depth <= 2) return "#22c55e";
							if (depth <= 4) return "#3b82f6";
							return "#8b5cf6";
						}}
						pannable
						zoomable
						className="bg-background"
					/>
				</ReactFlow>
			</div>
		</div>
	);

	return (
		<>
			{flowContent}
			<Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
				<DialogContent className="w-screen h-screen max-w-none p-0 border-0 rounded-none">
					<div className="w-full h-full relative">
						<ReactFlow
							nodes={nodes}
							edges={edges}
							onNodesChange={onNodesChange}
							onEdgesChange={onEdgesChange}
							onNodeClick={handleNodeClick}
							nodeTypes={nodeTypes}
							fitView
							minZoom={0.1}
							maxZoom={1.5}
						>
							<Background />
							<MiniMap
								nodeColor={(node) => {
									if (node.id === currentNodeId) return "#f97316";
									const depth =
										(node.data as unknown as ConversationNode["data"])?.depth ??
										0;
									if (depth === 0) return "#f97316";
									if (depth <= 2) return "#22c55e";
									if (depth <= 4) return "#3b82f6";
									return "#8b5cf6";
								}}
								pannable
								zoomable
							/>
						</ReactFlow>
						<Button
							variant="outline"
							size="icon"
							className="absolute top-2 right-2 h-8 w-8 z-10"
							onClick={() => setIsFullscreen(false)}
						>
							<Minimize2 className="h-4 w-4" />
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
