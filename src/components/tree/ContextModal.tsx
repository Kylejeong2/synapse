import { Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useContextChain } from "@/hooks/useConversation";
import type { Id } from "../../../convex/_generated/dataModel";

interface ContextModalProps {
	nodeId: Id<"nodes">;
	onClose: () => void;
}

export function ContextModal({ nodeId }: ContextModalProps) {
	const contextChain = useContextChain(nodeId);

	const handleCopyContext = () => {
		if (!contextChain) return;

		const text = contextChain.chain
			.map(
				(node) =>
					`User: ${node.userPrompt}\n\nAssistant: ${node.assistantResponse}\n\n---\n\n`,
			)
			.join("");

		navigator.clipboard.writeText(text);
		toast.success("Context copied to clipboard");
	};

	if (!contextChain) {
		return (
			<DialogContent>
				<div className="text-center py-8">Loading context...</div>
			</DialogContent>
		);
	}

	const percentage = (contextChain.totalTokens / 128000) * 100;

	return (
		<DialogContent className="max-w-3xl max-h-[80vh]">
			<DialogHeader>
				<DialogTitle>Context Chain</DialogTitle>
				<DialogDescription>
					Full conversation context leading to this node
				</DialogDescription>
				<div className="flex gap-2 items-center pt-2">
					<Badge>
						{contextChain.totalTokens.toLocaleString()} / 128,000 tokens (
						{percentage.toFixed(1)}%)
					</Badge>
					<Button variant="ghost" size="sm" onClick={handleCopyContext}>
						<Copy className="h-4 w-4 mr-2" />
						Copy
					</Button>
				</div>
			</DialogHeader>

			<ScrollArea className="h-[500px] pr-4">
				<div className="space-y-4">
					{contextChain.chain.map((node, idx) => (
						<div key={node._id}>
							<Card>
								<CardContent className="pt-4 space-y-3">
									{/* User Prompt */}
									<div className="flex items-start gap-3">
										<Avatar className="h-6 w-6 shrink-0">
											<AvatarFallback className="bg-primary text-primary-foreground text-xs">
												U
											</AvatarFallback>
										</Avatar>
										<div className="flex-1 prose prose-sm dark:prose-invert max-w-none">
											<p className="text-sm">{node.userPrompt}</p>
										</div>
									</div>

									{/* AI Response */}
									<div className="flex items-start gap-3">
										<Avatar className="h-6 w-6 shrink-0">
											<AvatarFallback className="bg-linear-to-r from-orange-500 to-red-600 text-white text-xs">
												AI
											</AvatarFallback>
										</Avatar>
										<div className="flex-1 prose prose-sm dark:prose-invert max-w-none">
											<ReactMarkdown
												rehypePlugins={[rehypeHighlight]}
												remarkPlugins={[remarkGfm]}
											>
												{node.assistantResponse}
											</ReactMarkdown>
										</div>
									</div>

									{/* Tokens info */}
									<div className="flex justify-between items-center pt-2 text-xs text-muted-foreground">
										<span>Depth: {node.depth}</span>
										<span>
											{node.tokensUsed.toLocaleString()} tokens (cumulative:{" "}
											{node.cumulativeTokens.toLocaleString()})
										</span>
									</div>
								</CardContent>
							</Card>

							{idx < contextChain.chain.length - 1 && (
								<Separator className="my-4" />
							)}
						</div>
					))}
				</div>
			</ScrollArea>
		</DialogContent>
	);
}
