import { type UIMessage, useChat } from "@ai-sdk/react";
import { useNavigate } from "@tanstack/react-router";
import { TextStreamChatTransport } from "ai";
import { useEffect, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useConversation, useNodeAncestors } from "@/hooks/useConversation";
import type { Id } from "../../../convex/_generated/dataModel";
import { FlowMiniMap } from "./FlowMiniMap";
import { InputBar } from "./InputBar";
import { MessageList } from "./MessageList";
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
	const conversation = useConversation(conversationId);
	const ancestors = useNodeAncestors(fromNodeId ?? null);

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
		return fromNodeId
			? `${conversationId}:${fromNodeId}:${ancestors?.length ?? 0}`
			: `${conversationId}`;
	}, [conversationId, fromNodeId, ancestors?.length]);

	const { messages, sendMessage, status } = useChat({
		id: sessionId,
		transport: new TextStreamChatTransport({
			api: "/api/chat",
			body: {
				conversationId,
				nodeId: fromNodeId,
			},
		}),
	});

	const isLoading = status === "submitted" || status === "streaming";
	const prevStatusRef = useRef(status);

	// After a message is sent and the response completes, navigate to the new child node
	// so subsequent messages build on it instead of creating siblings
	useEffect(() => {
		const prevStatus = prevStatusRef.current;
		prevStatusRef.current = status;

		// Detect when streaming just finished
		if (
			prevStatus === "streaming" &&
			status !== "streaming" &&
			status !== "submitted"
		) {
			if (!conversation?.nodes || conversation.nodes.length === 0) return;

			let targetNode: (typeof conversation.nodes)[0] | undefined;

			if (fromNodeId) {
				// Find the most recently created node that is a child of fromNodeId
				const children = conversation.nodes.filter(
					(node) => node.parentId === fromNodeId,
				);

				if (children.length > 0) {
					// Get the most recent child
					targetNode = children.reduce((latest, current) =>
						current._creationTime > latest._creationTime ? current : latest,
					);
				}
			} else {
				// If no fromNodeId (first message), find the most recent root node
				const rootNodes = conversation.nodes.filter((node) => !node.parentId);

				if (rootNodes.length > 0) {
					targetNode = rootNodes.reduce((latest, current) =>
						current._creationTime > latest._creationTime ? current : latest,
					);
				}
			}

			// Navigate to update the URL with the new node as fromNode
			if (targetNode && targetNode._id !== fromNodeId) {
				navigate({
					to: "/chat/$id",
					params: { id: conversationId },
					search: { fromNode: targetNode._id },
					replace: true,
				});
			}
		}
	}, [status, conversation?.nodes, fromNodeId, conversationId, navigate]);

	const displayMessages = useMemo(() => {
		if (!initialMessages?.length) return messages;
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
		<div className="flex flex-col h-screen overflow-auto">
			{/* Header with sidebar trigger and fork indicator */}
			<div className="border-b bg-background/80 backdrop-blur-sm">
				<div className="flex items-center gap-2 px-4 py-2">
					<SidebarTrigger />
					{forkingFromPrompt && (
						<Badge variant="secondary" className="text-xs">
							Forking from: {forkingFromPrompt.slice(0, 50)}
							{forkingFromPrompt.length > 50 ? "..." : ""}
						</Badge>
					)}
				</div>
			</div>

			{/* Messages */}
			<MessageList messages={displayMessages} isLoading={isLoading} />

			{/* Input */}
			<div className="border-t bg-background p-4">
				<div className="max-w-3xl mx-auto">
					<InputBar
						onSend={handleSend}
						isLoading={isLoading}
						placeholder="Type your message... (Shift+Enter for new line)"
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
