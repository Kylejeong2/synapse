import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import { useMemo } from "react";

interface LayoutNode {
	_id: string;
	parentId?: string;
	userPrompt: string;
	assistantResponse: string;
	tokensUsed: number;
	depth: number;
	position: { x: number; y: number };
}

export function useTreeLayout(nodes: LayoutNode[]) {
	return useMemo(() => {
		const dagreGraph = new dagre.graphlib.Graph();
		dagreGraph.setDefaultEdgeLabel(() => ({}));

		// Configure the graph layout
		dagreGraph.setGraph({
			rankdir: "TB", // Top to bottom
			nodesep: 100, // Horizontal spacing between nodes
			ranksep: 150, // Vertical spacing between levels
			marginx: 50,
			marginy: 50,
		});

		const nodeWidth = 280;
		const nodeHeight = 180;

		// Add nodes to the graph
		nodes.forEach((node) => {
			dagreGraph.setNode(node._id, { width: nodeWidth, height: nodeHeight });
		});

		// Add edges based on parent-child relationships
		nodes.forEach((node) => {
			if (node.parentId) {
				dagreGraph.setEdge(node.parentId, node._id);
			}
		});

		// Calculate layout
		dagre.layout(dagreGraph);

		// Create React Flow nodes
		const flowNodes: Node[] = nodes.map((node) => {
			const dagreNode = dagreGraph.node(node._id);

			return {
				id: node._id,
				type: "conversationNode",
				position: {
					x: dagreNode.x - nodeWidth / 2,
					y: dagreNode.y - nodeHeight / 2,
				},
				data: {
					userPrompt: node.userPrompt,
					assistantResponse: node.assistantResponse,
					tokensUsed: node.tokensUsed,
					depth: node.depth,
				},
			};
		});

		// Create React Flow edges
		const flowEdges: Edge[] = nodes
			.filter((node) => node.parentId)
			.map((node) => ({
				id: `${node.parentId}-${node._id}`,
				source: node.parentId as string,
				target: node._id,
				type: "smoothstep",
				animated: false,
				style: { stroke: "#64748b", strokeWidth: 2 },
			}));

		return { nodes: flowNodes, edges: flowEdges };
	}, [nodes]);
}
