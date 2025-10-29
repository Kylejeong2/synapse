import { useChat, type UIMessage } from "@ai-sdk/react";
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
import { useNodeAncestors } from "@/hooks/useConversation";
import { useMemo } from "react";
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
    const ancestors = useNodeAncestors(fromNodeId ?? null);

    const initialMessages: UIMessage[] = useMemo(() => {
        if (!ancestors || ancestors.length === 0) return [];
        const msgs: UIMessage[] = [];
        for (let i = 0; i < ancestors.length; i++) {
            const node = ancestors[i] as any;
            msgs.push({
                id: `anc-${i}-u`,
                role: "user",
                parts: [{ type: "text", text: node.userPrompt }],
            });
            msgs.push({
                id: `anc-${i}-a`,
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
