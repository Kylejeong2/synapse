import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { Badge } from "@/components/ui/badge";
import type { Id } from "../../../convex/_generated/dataModel";
import { InputBar } from "./InputBar";
import { MessageList } from "./MessageList";
import { TreeViewButton } from "./TreeViewButton";
import { FlowMiniMap } from "./FlowMiniMap";
import { useConversation } from "@/hooks/useConversation";
import { useNavigate } from "@tanstack/react-router";
import { ResizableLayout } from "./ResizableLayout";
import { SidebarTrigger } from "@/components/ui/sidebar";

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
	const { messages, sendMessage, status } = useChat({
		id: conversationId,
		transport: new TextStreamChatTransport({
			api: "/api/chat",
			body: {
				conversationId,
				nodeId: fromNodeId,
			},
		}),
	});

	const isLoading = status === "submitted" || status === "streaming";

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
			<MessageList messages={messages} isLoading={isLoading} />

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
