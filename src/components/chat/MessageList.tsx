import type { UIMessage } from "@ai-sdk/react";
import { memo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { markdownComponents } from "./MarkdownComponents";
import { ToolCallDisplay } from "./ToolCallDisplay";
import { ToolResultDisplay } from "./ToolResultDisplay";

interface MessageListProps {
	messages: UIMessage[];
	isLoading?: boolean;
	isThinkingModel?: boolean;
}

// Memoized message card to prevent re-rendering
const MessageCard = memo(({ message }: { message: UIMessage }) => {
	if (message.role === "user") {
		return (
			<div className="w-full py-4">
				<div className="max-w-3xl mx-auto px-4">
					<div className="flex justify-end">
						<div className="max-w-[70%] rounded-3xl px-5 py-2.5 bg-secondary text-secondary-foreground">
							{message.parts.map((part, idx) => {
								if (part.type === "text") {
									return (
										<div
											key={`${message.id}-text-${idx}`}
											className="text-[15px] leading-relaxed"
										>
											{part.text}
										</div>
									);
								}
								return null;
							})}
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Assistant message
	return (
		<div className="w-full">
			<div className="max-w-3xl mx-auto px-4 py-4">
				<div className="space-y-4">
					{message.parts.map((part, idx) => {
						if (part.type === "text") {
							return (
								<div
									key={`${message.id}-text-${idx}`}
									className="text-[15px] leading-[1.8] text-foreground"
								>
									<ReactMarkdown
										rehypePlugins={[rehypeKatex]}
										remarkPlugins={[remarkGfm, remarkMath]}
										components={markdownComponents}
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
				<div className="mt-4 border-b border-border/30" />
			</div>
		</div>
	);
});

MessageCard.displayName = "MessageCard";

// Thinking indicator for reasoning models
function ThinkingIndicator() {
	return (
		<div className="flex items-center gap-3 text-muted-foreground">
			<div className="relative flex items-center justify-center w-6 h-6">
				{/* Outer pulsing ring */}
				<div className="absolute w-6 h-6 rounded-full bg-violet-500/20 animate-ping" />
				{/* Inner spinning gradient */}
				<div className="relative w-4 h-4 rounded-full bg-linear-to-tr from-violet-500 to-purple-600 animate-spin" />
			</div>
			<span className="text-sm font-medium text-violet-400 animate-pulse">
				Thinking...
			</span>
		</div>
	);
}

export function MessageList({
	messages,
	isLoading,
	isThinkingModel,
}: MessageListProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const prevMessageCountRef = useRef(messages.length);

	// Track if user has intervened during current streaming message
	const userIntervenedRef = useRef(false);

	// Scroll to bottom helper - use 'auto' (instant) to avoid scroll event issues
	const scrollToBottom = useCallback(() => {
		if (!scrollRef.current) return;
		scrollRef.current.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: "auto",
		});
	}, []);

	// Detect ONLY user-initiated scroll attempts via wheel/touch
	// These events never fire on programmatic scrolls
	const handleUserScrollAttempt = useCallback(() => {
		if (isLoading) {
			userIntervenedRef.current = true;
		}
	}, [isLoading]);

	// Listen for wheel and touch events (user-only, never fires on programmatic scroll)
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;

		el.addEventListener("wheel", handleUserScrollAttempt, { passive: true });
		el.addEventListener("touchstart", handleUserScrollAttempt, {
			passive: true,
		});

		return () => {
			el.removeEventListener("wheel", handleUserScrollAttempt);
			el.removeEventListener("touchstart", handleUserScrollAttempt);
		};
	}, [handleUserScrollAttempt]);

	// Initial scroll on mount
	useLayoutEffect(() => {
		if (scrollRef.current && messages.length > 0) {
			scrollToBottom();
		}
		// Only run on mount
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [messages.length, scrollToBottom]);

	// Reset intervention flag and scroll to bottom when new message is added
	useEffect(() => {
		const messageCountChanged = messages.length !== prevMessageCountRef.current;

		if (messageCountChanged) {
			// New message node added - reset user intervention flag
			userIntervenedRef.current = false;
			prevMessageCountRef.current = messages.length;
			requestAnimationFrame(() => {
				scrollToBottom();
			});
		}
	}, [messages.length, scrollToBottom]);

	// Auto-scroll during streaming (only if user hasn't intervened)
	useEffect(() => {
		if (!isLoading || userIntervenedRef.current) return;

		// Scroll to bottom on content updates during streaming
		requestAnimationFrame(() => {
			scrollToBottom();
		});
	}, [isLoading, scrollToBottom]);

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
		<div
			className="flex-1 bg-background overflow-y-auto overflow-x-hidden"
			ref={scrollRef}
		>
			<div className="w-full">
				{messages.map((message) => (
					<MessageCard key={message.id} message={message} />
				))}

				{isLoading && (
					<div className="w-full">
						<div className="max-w-3xl mx-auto px-4 py-4">
							{isThinkingModel ? (
								<ThinkingIndicator />
							) : (
								<div className="flex gap-2">
									<div className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
									<div className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
									<div className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce" />
								</div>
							)}
							<div className="mt-4 border-b border-border/30" />
						</div>
					</div>
				)}
				<div ref={bottomRef} className="h-32" />
			</div>
		</div>
	);
}
