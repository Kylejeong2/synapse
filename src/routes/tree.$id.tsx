import { useUser } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useEffect } from "react";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { ConversationTree } from "@/components/tree/ConversationTree";
import { Button } from "@/components/ui/button";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useConversation } from "@/hooks/useConversation";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/tree/$id")({
	component: TreePage,
});

function TreePage() {
	const { id } = Route.useParams();
	const { isSignedIn } = useUser();
	const navigate = useNavigate();
	const conversation = useConversation(id as Id<"conversations">);

	useEffect(() => {
		if (!isSignedIn) {
			navigate({ to: "/" });
		}
	}, [isSignedIn, navigate]);

	if (!conversation) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="text-muted-foreground">
					Loading conversation tree...
				</div>
			</div>
		);
	}

	return (
		<SidebarProvider defaultOpen={false}>
			<AppSidebar />
			<SidebarInset>
				<div className="relative h-screen">
					{/* Header */}
					<div className="absolute top-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-sm border-b">
						<div className="container mx-auto px-4 py-3 flex items-center justify-between">
							<div className="flex items-center gap-3">
								<SidebarTrigger />
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => navigate({ to: "/" })}
											>
												<ArrowLeft className="h-5 w-5" />
											</Button>
										</TooltipTrigger>
										<TooltipContent>Back to conversations</TooltipContent>
									</Tooltip>
								</TooltipProvider>
								<div>
									<h1 className="font-semibold">{conversation.title}</h1>
									<p className="text-xs text-muted-foreground">
										{conversation.nodes?.length || 0} nodes in tree
									</p>
								</div>
							</div>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="outline"
											onClick={() =>
												navigate({
													to: "/chat/$id",
													params: { id },
													search: { fromNode: id },
												})
											}
										>
											<MessageSquare className="h-4 w-4 mr-2" />
											Chat View
										</Button>
									</TooltipTrigger>
									<TooltipContent>Switch to chat view</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
					</div>

					{/* Tree */}
					<div className="pt-[73px] h-full">
						<ConversationTree
							nodes={conversation.nodes || []}
							conversationId={id}
						/>
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
