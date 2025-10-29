import type { UIMessage } from "@ai-sdk/react";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface MessageListProps {
	messages: UIMessage[];
	isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// Use requestAnimationFrame to ensure DOM has updated
		requestAnimationFrame(() => {
			bottomRef.current?.scrollIntoView({ behavior: "smooth" });
		});
	}, [messages, isLoading]);

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
					<Card
						key={message.id}
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
							<div className="flex-1 min-w-0 prose prose-sm dark:prose-invert max-w-none">
								<ReactMarkdown
									rehypePlugins={[rehypeHighlight]}
									remarkPlugins={[remarkGfm]}
								>
									{message.parts
										.map((part) => {
											if (part.type === "text") return part.text;
											return "";
										})
										.join("")}
								</ReactMarkdown>
							</div>
						</div>
					</Card>
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
