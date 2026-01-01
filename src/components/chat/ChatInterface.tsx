import { type UIMessage, useChat } from "@ai-sdk/react";
import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "@tanstack/react-router";
import { TextStreamChatTransport } from "ai";
import { useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
	useConversation,
	useNodeAncestors,
	useUpdateDefaultModel,
} from "@/hooks/useConversation";
import { DEFAULT_MODEL, MODELS, type ModelId } from "@/lib/constants/models";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FlowMiniMap } from "./FlowMiniMap";
import { InputBar } from "./InputBar";
import { MessageList } from "./MessageList";
import { ModelSelector } from "./ModelSelector";
import { ResizableLayout } from "./ResizableLayout";
import { TreeViewButton } from "./TreeViewButton";

interface ChatInterfaceProps {
	conversationId: Id<"conversations">;
	fromNodeId?: Id<"nodes">;
	forkingFromPrompt?: string;
}

export function ChatInterface({
	conversationId,
	fromNodeId,
	forkingFromPrompt,
}: ChatInterfaceProps) {
	const navigate = useNavigate();
	const { user } = useUser();
	const conversation = useConversation(conversationId);
	const ancestors = useNodeAncestors(fromNodeId ?? null);
	const updateDefaultModel = useUpdateDefaultModel();
	const usageStats = useQuery(
		api.rateLimiting.getUsageStats,
		user?.id ? { userId: user.id } : "skip",
	);

	// Model state - initialize from conversation's defaultModel or fallback to default
	const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL);

	// Sync model selection with conversation's defaultModel when it loads
	useEffect(() => {
		if (conversation?.defaultModel) {
			const model = conversation.defaultModel as ModelId;
			if (model in MODELS) {
				setSelectedModel(model);
			}
		}
	}, [conversation?.defaultModel]);

	const handleModelChange = (model: ModelId) => {
		setSelectedModel(model);
		// Persist to conversation
		updateDefaultModel({ conversationId, model });
	};

	const isThinkingModel = MODELS[selectedModel]?.thinking ?? false;

	const initialMessages: UIMessage[] = useMemo(() => {
		if (!ancestors || ancestors.length === 0) return [];
		const msgs: UIMessage[] = [];
		for (const node of ancestors) {
			msgs.push({
				id: `${node._id}-u`,
				role: "user",
				parts: [{ type: "text", text: node.userPrompt }],
			});
			msgs.push({
				id: `${node._id}-a`,
				role: "assistant",
				parts: [{ type: "text", text: node.assistantResponse }],
			});
		}
		return msgs;
	}, [ancestors]);

	const sessionId = useMemo(() => {
		const base = fromNodeId
			? `${conversationId}:${fromNodeId}:${ancestors?.length ?? 0}`
			: `${conversationId}`;
		return `${base}:${selectedModel}`;
	}, [conversationId, fromNodeId, ancestors?.length, selectedModel]);

	// Keep session stable during streaming so we don't reset the chat hook
	const activeSessionIdRef = useRef(sessionId);
	const statusRef = useRef<"streaming" | "submitted" | "ready" | "error">(
		"ready",
	);

	if (
		statusRef.current !== "streaming" &&
		statusRef.current !== "submitted" &&
		sessionId !== activeSessionIdRef.current
	) {
		activeSessionIdRef.current = sessionId;
	}

	const transport = useMemo(
		() =>
			new TextStreamChatTransport({
				api: "/api/chat",
				body: {
					conversationId,
					nodeId: fromNodeId,
					model: selectedModel,
				},
			}),
		[conversationId, fromNodeId, selectedModel],
	);

	const { messages, sendMessage, status } = useChat({
		id: activeSessionIdRef.current,
		transport,
	});

	statusRef.current = status;
	const isLoading = status === "submitted" || status === "streaming";

	// Seamless navigation: Navigate to new node as soon as it's created
	useEffect(() => {
		if (!isLoading) return;
		if (!conversation?.nodes) return;

		// Find a new child node created after the interaction started
		// We can check if there's a node that is a child of the current fromNodeId (or root if none)
		// and is very recent.
		// However, a simpler check is just: is there a child of fromNodeId that we aren't currently on?

		let targetNode: (typeof conversation.nodes)[0] | undefined;

		if (fromNodeId) {
			const children = conversation.nodes.filter(
				(node) => node.parentId === fromNodeId,
			);
			// Sort by creation time descending
			children.sort((a, b) => b._creationTime - a._creationTime);
			targetNode = children[0];
		} else {
			const rootNodes = conversation.nodes.filter((node) => !node.parentId);
			rootNodes.sort((a, b) => b._creationTime - a._creationTime);
			targetNode = rootNodes[0];
		}

		// If we found a target node and it's different from where we are
		// AND it looks like it matches our current interaction (e.g. created very recently)
		// We navigate to it.
		if (targetNode && targetNode._id !== fromNodeId) {
			// We only navigate if this seems to be the node we just created.
			// Since we are "isLoading", we assume the user just sent a message.
			// The backend creates the node almost immediately.
			navigate({
				to: "/chat/$id",
				params: { id: conversationId },
				search: { fromNode: targetNode._id },
				replace: true,
			});
		}
	}, [conversation?.nodes, fromNodeId, isLoading, conversationId, navigate]);

	const displayMessages = useMemo(() => {
		if (!initialMessages?.length) return messages;

		// If we have local messages (streaming), we might have also navigated to the new node already.
		// If we navigated, the new node is in `initialMessages`.
		// We need to de-duplicate.

		if (messages.length > 0) {
			// const lastLocalMessage = messages[messages.length - 1];
			// const lastInitialMessage = initialMessages[initialMessages.length - 1];

			// Simple check: if we have both, and we are streaming, the local `messages` are the "active" ones.
			// If we navigated, `initialMessages` now includes the User/Assistant pair for the new node.
			// But `messages` ALSO has them (or at least the user part and streaming assistant part).

			// If we are streaming (messages.length > 0), we generally want to show
			// the `initialMessages` UP TO the point where the stream starts.

			// If we navigated to the new node, `initialMessages` has 2 more messages than before (User + AI).
			// We should exclude those 2 from `initialMessages` and let `messages` handle the display
			// so we get the live stream effect.

			// Heuristic: Check if the last user message in initialMessages matches the first user message in messages
			const firstLocalUserMsg = messages.find((m) => m.role === "user");

			if (firstLocalUserMsg) {
				// Find where this message starts in initialMessages
				const matchIndex = initialMessages.findIndex(
					(m) =>
						m.role === "user" &&
						m.parts[0].type === "text" &&
						firstLocalUserMsg.parts[0].type === "text" &&
						m.parts[0].text === firstLocalUserMsg.parts[0].text,
				);

				if (matchIndex !== -1) {
					// Return everything before the match, plus the local messages
					return [...initialMessages.slice(0, matchIndex), ...messages];
				}
			}
		}

		return [...initialMessages, ...messages];
	}, [initialMessages, messages]);

	const handleSend = (text: string) => {
		sendMessage({ role: "user", parts: [{ type: "text", text }] });
	};

	const handleNodeClick = (nodeId: string) => {
		navigate({
			to: "/chat/$id",
			params: { id: conversationId },
			search: { fromNode: nodeId },
		});
	};

	const leftPanel = conversation?.nodes ? (
		<FlowMiniMap
			nodes={conversation.nodes}
			conversationId={conversationId}
			currentNodeId={fromNodeId}
			onNodeClick={handleNodeClick}
		/>
	) : null;

	const rightPanel = (
		<div className="flex flex-col h-screen">
			{/* Header with sidebar trigger, fork indicator, and model selector */}
			<div className="border-b bg-background/80 backdrop-blur-sm shrink-0">
				<div className="flex items-center justify-between px-4 py-2">
					<div className="flex items-center gap-2">
						<SidebarTrigger />
						{forkingFromPrompt && (
							<Badge variant="secondary" className="text-xs">
								Forking from: {forkingFromPrompt.slice(0, 50)}
								{forkingFromPrompt.length > 50 ? "..." : ""}
							</Badge>
						)}
					</div>
					<ModelSelector
						selectedModel={selectedModel}
						onModelChange={handleModelChange}
					/>
				</div>
				{/* Usage Indicator */}
				{usageStats && user?.id && (
					<div className="px-4 pb-2">
						{usageStats.tier === "paid" ? (
							<div className="flex items-center gap-4 text-xs text-muted-foreground">
								<div className="flex items-center gap-1">
									<span>Credit:</span>
									<span className="font-medium">
										${usageStats.remainingCredit.toFixed(2)} / $
										{usageStats.includedCredit.toFixed(2)}
									</span>
								</div>
								{usageStats.overageAmount > 0 && (
									<div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500">
										<span>Overage:</span>
										<span className="font-medium">
											${usageStats.overageAmount.toFixed(2)}
										</span>
									</div>
								)}
								<div className="flex items-center gap-1">
									<span>Tokens:</span>
									<span className="font-medium">
										{usageStats.tokensUsed.toLocaleString()}
									</span>
								</div>
							</div>
						) : (
							<div className="flex items-center gap-4 text-xs text-muted-foreground">
								<div className="flex items-center gap-1">
									<span>Tokens:</span>
									<span className="font-medium">
										{usageStats.tokensUsed.toLocaleString()} /{" "}
										{usageStats.maxTokens.toLocaleString()}
									</span>
								</div>
								<div className="flex items-center gap-1">
									<span>Conversations:</span>
									<span className="font-medium">
										{usageStats.conversationsUsed} /{" "}
										{usageStats.maxConversations}
									</span>
								</div>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Messages */}
			<MessageList
				messages={displayMessages}
				isLoading={isLoading}
				isThinkingModel={isThinkingModel}
			/>

			{/* Input - sticky at bottom */}
			<div className="border-t border-border/30 bg-background p-4 shrink-0">
				<div className="max-w-3xl mx-auto">
					<InputBar
						onSend={handleSend}
						isLoading={isLoading}
						placeholder="Message Synapse"
					/>
				</div>
			</div>

			{/* Tree View Button - now only shows on mobile */}
			<div className="md:hidden">
				<TreeViewButton conversationId={conversationId} />
			</div>
		</div>
	);

	return <ResizableLayout left={leftPanel} right={rightPanel} />;
}
