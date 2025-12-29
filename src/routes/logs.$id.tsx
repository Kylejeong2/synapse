import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Badge } from "../components/ui/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "../components/ui/card";
import { ScrollArea } from "../components/ui/scroll-area";

/**
 * Development-only log viewer page
 * Shows a timeline of operations and performance metrics for a conversation
 */
export const Route = createFileRoute("/logs/$id")({
	component: LogViewer,
});

function LogViewer() {
	const { id } = Route.useParams();
	const conversation = useQuery(api.conversations.getConversation, {
		conversationId: id as Id<"conversations">,
	});

	// Only show in development
	if (!import.meta.env.DEV) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Card className="w-96">
					<CardHeader>
						<CardTitle>Access Denied</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							Log viewer is only available in development mode.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!conversation) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Card className="w-96">
					<CardHeader>
						<CardTitle>Loading...</CardTitle>
					</CardHeader>
				</Card>
			</div>
		);
	}

	const nodes = conversation.nodes || [];
	const totalTokens = nodes.reduce(
		(sum, node) => sum + (node.tokensUsed || 0),
		0,
	);
	const avgTokensPerNode = nodes.length > 0 ? totalTokens / nodes.length : 0;

	return (
		<div className="container mx-auto py-8 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Conversation Logs</h1>
					<p className="text-sm text-muted-foreground">{conversation.title}</p>
				</div>
				<Badge variant="outline">Development Only</Badge>
			</div>

			{/* Summary Stats */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Total Nodes</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold">{nodes.length}</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Total Tokens</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold">{totalTokens.toLocaleString()}</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Avg Tokens/Node</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold">{Math.round(avgTokensPerNode)}</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-sm">Max Depth</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold">
							{Math.max(...nodes.map((n) => n.depth || 0), 0)}
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Node Timeline */}
			<Card>
				<CardHeader>
					<CardTitle>Node Timeline</CardTitle>
				</CardHeader>
				<CardContent>
					<ScrollArea className="h-[600px]">
						<div className="space-y-4">
							{nodes
								.sort((a, b) => a._creationTime - b._creationTime)
								.map((node, index) => (
									<Card key={node._id} className="border-l-4 border-l-primary">
										<CardHeader>
											<div className="flex items-start justify-between">
												<div className="space-y-1">
													<div className="flex items-center gap-2">
														<Badge variant="outline">#{index + 1}</Badge>
														<Badge variant="secondary">{node.model}</Badge>
														<Badge variant="outline">Depth: {node.depth}</Badge>
													</div>
													<p className="text-xs text-muted-foreground">
														{new Date(node._creationTime).toLocaleString()}
													</p>
												</div>
												<div className="text-right">
													<p className="text-sm font-semibold">
														{node.tokensUsed?.toLocaleString() || 0} tokens
													</p>
													<p className="text-xs text-muted-foreground">
														ID: {node._id.slice(0, 8)}...
													</p>
												</div>
											</div>
										</CardHeader>
										<CardContent className="space-y-3">
											<div>
												<p className="text-xs font-semibold text-muted-foreground mb-1">
													User Prompt
												</p>
												<p className="text-sm line-clamp-2">
													{node.userPrompt}
												</p>
											</div>
											<div>
												<p className="text-xs font-semibold text-muted-foreground mb-1">
													Assistant Response
												</p>
												<p className="text-sm line-clamp-3">
													{node.assistantResponse || "(streaming...)"}
												</p>
											</div>
											{node.parentId && (
												<div>
													<p className="text-xs text-muted-foreground">
														Parent: {node.parentId.slice(0, 8)}...
													</p>
												</div>
											)}
										</CardContent>
									</Card>
								))}
						</div>
					</ScrollArea>
				</CardContent>
			</Card>

			{/* Token Usage Breakdown */}
			<Card>
				<CardHeader>
					<CardTitle>Token Usage by Model</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{Object.entries(
							nodes.reduce(
								(acc, node) => {
									const model = node.model || "unknown";
									acc[model] = (acc[model] || 0) + (node.tokensUsed || 0);
									return acc;
								},
								{} as Record<string, number>,
							),
						)
							.sort(([, a], [, b]) => b - a)
							.map(([model, tokens]) => (
								<div key={model} className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Badge variant="secondary">{model}</Badge>
										<p className="text-sm text-muted-foreground">
											{nodes.filter((n) => n.model === model).length} nodes
										</p>
									</div>
									<p className="text-sm font-semibold">
										{tokens.toLocaleString()} tokens
									</p>
								</div>
							))}
					</div>
				</CardContent>
			</Card>

			{/* Debug Info */}
			<Card>
				<CardHeader>
					<CardTitle>Debug Information</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-2 text-sm">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Conversation ID:</span>
							<span className="font-mono">{conversation._id}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">User ID:</span>
							<span className="font-mono">{conversation.userId}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Root Node ID:</span>
							<span className="font-mono">
								{conversation.rootNodeId || "N/A"}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Last Accessed:</span>
							<span>
								{new Date(conversation.lastAccessedAt).toLocaleString()}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Created:</span>
							<span>
								{new Date(conversation._creationTime).toLocaleString()}
							</span>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
