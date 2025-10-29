import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "@tanstack/react-router";
import { MessageSquare, Plus, Home } from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	useConversations,
	useCreateConversation,
} from "@/hooks/useConversation";
import { useState } from "react";
import { HeaderUser } from "@/integrations/clerk/header-user";
import { Doc } from "convex/_generated/dataModel";

export function AppSidebar() {
	const { user } = useUser();
	const navigate = useNavigate();
	const conversations = useConversations(user?.id);
	const createConversation = useCreateConversation();
	const [isCreating, setIsCreating] = useState(false);

	const handleNewConversation = async () => {
		if (!user?.id) return;
		setIsCreating(true);
		try {
			const conversationId = await createConversation({
				userId: user.id,
				title: "New Conversation",
			});
			navigate({
				to: "/chat/$id",
				params: { id: conversationId },
				search: { fromNode: undefined },
			});
		} catch (error) {
			console.error("Failed to create conversation:", error);
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<Sidebar>
			<SidebarHeader className="border-b p-4">
				<div className="flex items-center gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
						<MessageSquare className="h-4 w-4" />
					</div>
					<div className="flex flex-col">
						<span className="font-semibold text-sm">Synapse</span>
						<span className="text-xs text-muted-foreground">AI Chat</span>
					</div>
				</div>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton asChild>
									<button type="button" onClick={() => navigate({ to: "/" })}>
										<Home className="h-4 w-4" />
										<span>Home</span>
									</button>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarSeparator />

				<SidebarGroup>
					<div className="flex items-center justify-between px-2 mb-2">
						<SidebarGroupLabel>Conversations</SidebarGroupLabel>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={handleNewConversation}
							disabled={isCreating}
						>
							<Plus className="h-4 w-4" />
						</Button>
					</div>
					<SidebarGroupContent>
						<ScrollArea className="h-[calc(100vh-300px)]">
							<SidebarMenu>
								{conversations?.map((conversation: Doc<"conversations">) => (
									<SidebarMenuItem key={conversation._id}>
										<SidebarMenuButton
											asChild
											className="flex items-center justify-between"
										>
											<button
												type="button"
												onClick={() =>
													navigate({
														to: "/chat/$id",
														params: { id: conversation._id },
														search: { fromNode: undefined },
													})
												}
											>
												<div className="flex items-center gap-2 flex-1 min-w-0">
													<MessageSquare className="h-4 w-4 shrink-0" />
													<span className="truncate">{conversation.title}</span>
												</div>
												<Badge
													variant="secondary"
													className="text-xs ml-2 shrink-0"
												>
													{conversation.nodeCount}
												</Badge>
											</button>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
								{conversations && conversations.length === 0 && (
									<div className="px-2 py-4 text-xs text-muted-foreground text-center">
										No conversations yet
									</div>
								)}
							</SidebarMenu>
						</ScrollArea>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="border-t p-4">
				<HeaderUser />
			</SidebarFooter>
		</Sidebar>
	);
}
