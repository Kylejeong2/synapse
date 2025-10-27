import {
	Background,
	Controls,
	MiniMap,
	type NodeTypes,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import { useCallback } from "react";
import "@xyflow/react/dist/style.css";
import { useTreeLayout } from "@/hooks/useTreeLayout";
import { NodeCard } from "./NodeCard";

interface ConversationTreeProps {
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
}

const nodeTypes: NodeTypes = {
	conversationNode: NodeCard,
};

export function ConversationTree({
	nodes: dbNodes,
	conversationId,
}: ConversationTreeProps) {
	const { nodes: layoutNodes, edges: layoutEdges } = useTreeLayout(dbNodes);

	// Add conversationId to node data
	const nodesWithConvId = layoutNodes.map((node) => ({
		...node,
		data: {
			...node.data,
			conversationId,
		},
	}));

	const [nodes, , onNodesChange] = useNodesState(nodesWithConvId);
	const [edges, , onEdgesChange] = useEdgesState(layoutEdges);

	const onNodeClick = useCallback(
		(_event: React.MouseEvent, node: { id: string }) => {
			console.log("Node clicked:", node);
		},
		[],
	);

	if (dbNodes.length === 0) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="text-center">
					<p className="text-muted-foreground">
						No messages yet. Start chatting to see the tree!
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="w-full h-screen">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onNodeClick={onNodeClick}
				nodeTypes={nodeTypes}
				fitView
				minZoom={0.1}
				maxZoom={1.5}
				defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
			>
				<Background />
				<Controls />
				<MiniMap
					nodeColor={(node) => {
						const depth = node.data?.depth || 0;
						// Color based on depth
						if (depth === 0) return "#f97316"; // orange
						if (depth <= 2) return "#22c55e"; // green
						if (depth <= 4) return "#3b82f6"; // blue
						return "#8b5cf6"; // purple
					}}
					pannable
					zoomable
				/>
			</ReactFlow>
		</div>
	);
}
