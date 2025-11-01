import type { UIMessage } from "@ai-sdk/react";
import { memo, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ToolCallDisplay } from "./ToolCallDisplay";
import { ToolResultDisplay } from "./ToolResultDisplay";

interface MessageListProps {
	messages: UIMessage[];
	isLoading?: boolean;
}

// Memoized message card to prevent re-rendering
const MessageCard = memo(({ message }: { message: UIMessage }) => {
	return (
		<Card
			className={`p-4 ${
				message.role === "assistant" ? "bg-accent/50" : "bg-card"
			}`}
		>
			<div className="flex items-start gap-3">
				<Avatar className="h-8 w-8 shrink-0">
					<AvatarFallback
						className={
							message.role === "assistant"
								? "bg-linear-to-r from-orange-500 to-red-600 text-white"
								: "bg-primary text-primary-foreground"
						}
					>
						{message.role === "assistant" ? "AI" : "U"}
					</AvatarFallback>
				</Avatar>
				<div className="flex-1 min-w-0">
					{message.parts.map((part, idx) => {
						if (part.type === "text") {
							return (
								<div
									key={`${message.id}-text-${idx}`}
									className="prose prose-sm dark:prose-invert max-w-none"
								>
									<ReactMarkdown
										rehypePlugins={[rehypeHighlight]}
										remarkPlugins={[remarkGfm]}
									>
										{part.text}
									</ReactMarkdown>
								</div>
							);
						}

						// Handle tool calls and results
						if (part.type.startsWith("tool-")) {
							const toolPart = part as unknown as {
								toolName?: string;
								toolCallId?: string;
								[key: string]: unknown;
							};
							if (toolPart.toolName) {
								// This is a tool call or result
								if (part.type.includes("result")) {
									return (
										<ToolResultDisplay
											key={`${message.id}-result-${toolPart.toolCallId || idx}`}
											result={toolPart}
										/>
									);
								}
								return (
									<ToolCallDisplay
										key={`${message.id}-call-${toolPart.toolCallId || idx}`}
										toolCall={toolPart}
									/>
								);
							}
						}

						return null;
					})}
				</div>
			</div>
		</Card>
	);
});

MessageCard.displayName = "MessageCard";

export function MessageList({ messages, isLoading }: MessageListProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const prevMessagesLengthRef = useRef(messages.length);

	// Debounced scroll - only scroll when new messages are added, not on content updates
	useEffect(() => {
		if (messages.length > prevMessagesLengthRef.current) {
			// New message added
			requestAnimationFrame(() => {
				bottomRef.current?.scrollIntoView({ behavior: "smooth" });
			});
		}
		prevMessagesLengthRef.current = messages.length;
	}, [messages.length]);

	// Also scroll when loading state changes (new AI response starting)
	useEffect(() => {
		if (isLoading) {
			requestAnimationFrame(() => {
				bottomRef.current?.scrollIntoView({ behavior: "smooth" });
			});
		}
	}, [isLoading]);

	if (messages.length === 0 && !isLoading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center max-w-md">
					<h2 className="text-2xl font-bold mb-2">Start a conversation</h2>
					<p className="text-muted-foreground">
						Type a message below to begin. You can fork any conversation later
						from the tree view.
					</p>
				</div>
			</div>
		);
	}

	return (
		<ScrollArea className="flex-1 px-4" ref={scrollRef}>
			<div className="max-w-3xl mx-auto py-8 space-y-6">
				{messages.map((message) => (
					<MessageCard key={message.id} message={message} />
				))}

				{isLoading && (
					<Card className="p-4 bg-accent/50">
						<div className="flex items-start gap-3">
							<Avatar className="h-8 w-8 shrink-0">
								<AvatarFallback className="bg-linear-to-r from-orange-500 to-red-600 text-white">
									AI
								</AvatarFallback>
							</Avatar>
							<div className="flex-1 space-y-2">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-3/4" />
							</div>
						</div>
					</Card>
				)}
				<div ref={bottomRef} />
			</div>
		</ScrollArea>
	);
}
