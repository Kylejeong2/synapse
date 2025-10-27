import { useNavigate } from "@tanstack/react-router";
import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { GitBranch, MessageSquare } from "lucide-react";
import { memo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Id } from "../../../convex/_generated/dataModel";
import { ContextIndicator } from "./ContextIndicator";
import { useContextChain } from "@/hooks/useConversation";

export interface NodeData extends Record<string, unknown> {
	userPrompt: string;
	assistantResponse: string;
	tokensUsed: number;
	depth: number;
	conversationId?: string;
}

export type ConversationNode = Node<NodeData, "conversationNode">;

export const NodeCard = memo((props: NodeProps<ConversationNode>) => {
	const { data, id } = props;
	const navigate = useNavigate();
	const contextChain = useContextChain(id as Id<"nodes">);

	const handleForkFromHere = () => {
		if (data?.conversationId) {
			navigate({
				to: "/chat/$id",
				params: { id: data.conversationId },
				search: { fromNode: id },
			});
		}
	};

	const handleJumpToChat = () => {
		if (data?.conversationId) {
			navigate({
				to: "/chat/$id",
				params: { id: data.conversationId },
				search: { fromNode: id },
			});
		}
	};

	return (
		<>
			<Handle type="target" position={Position.Top} className="w-3 h-3" />
			<Card className="w-[280px] shadow-lg hover:shadow-xl transition-shadow">
				<CardHeader className="space-y-2 pb-3">
					<div className="flex items-start gap-2">
						<Avatar className="h-6 w-6 shrink-0">
							<AvatarFallback className="bg-primary text-primary-foreground text-xs">
								U
							</AvatarFallback>
						</Avatar>
						<p className="text-xs flex-1 line-clamp-2 leading-tight">
							{data?.userPrompt}
						</p>
					</div>
					<Badge variant="secondary" className="w-fit text-xs">
						Depth {data.depth}
					</Badge>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex items-start gap-2">
						<Avatar className="h-6 w-6 shrink-0">
							<AvatarFallback className="bg-linear-to-r from-orange-500 to-red-600 text-white text-xs">
								AI
							</AvatarFallback>
						</Avatar>
						<p className="text-xs text-muted-foreground flex-1 line-clamp-3 leading-tight">
							{data.assistantResponse}
						</p>
					</div>

					<ContextIndicator
						nodeId={id as Id<"nodes">}
						tokensUsed={data.tokensUsed}
						cumulativeTokens={contextChain?.totalTokens}
					/>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="w-full">
								Actions
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuItem onClick={handleForkFromHere}>
								<GitBranch className="h-4 w-4 mr-2" />
								Fork from here
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleJumpToChat}>
								<MessageSquare className="h-4 w-4 mr-2" />
								Jump to chat
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</CardContent>
			</Card>
			<Handle type="source" position={Position.Bottom} className="w-3 h-3" />
		</>
	);
});

NodeCard.displayName = "NodeCard";
