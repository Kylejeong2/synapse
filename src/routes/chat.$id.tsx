import { useUser } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChatInterface } from "@/components/chat/ChatInterface";
import {
	useConversation,
	useUpdateLastAccessed,
} from "@/hooks/useConversation";
import type { Id } from "../../convex/_generated/dataModel";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/navigation/AppSidebar";

export const Route = createFileRoute("/chat/$id")({
	component: ChatPage,
	validateSearch: (search: Record<string, unknown>) => {
		return {
			fromNode: search.fromNode as string | undefined,
		};
	},
});

function ChatPage() {
	const { id } = Route.useParams();
	const { fromNode } = Route.useSearch();
	const { isSignedIn } = useUser();
	const navigate = useNavigate();
	const conversation = useConversation(id as Id<"conversations">);
	const updateLastAccessed = useUpdateLastAccessed();

	useEffect(() => {
		if (!isSignedIn) {
			navigate({ to: "/" });
		}
	}, [isSignedIn, navigate]);

	useEffect(() => {
		if (id) {
			updateLastAccessed({ conversationId: id as Id<"conversations"> });
		}
	}, [id, updateLastAccessed]);

	if (!conversation) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="text-muted-foreground">Loading conversation...</div>
			</div>
		);
	}

	// Find the node if we're forking
	let forkingFromPrompt: string | undefined;
	if (fromNode && conversation.nodes) {
		const node = conversation.nodes.find((n) => n._id === fromNode);
		if (node) {
			forkingFromPrompt = node.userPrompt;
		}
	}

	return (
		<SidebarProvider defaultOpen={false}>
			<AppSidebar />
			<SidebarInset>
				<ChatInterface
					conversationId={id as Id<"conversations">}
					fromNodeId={fromNode as Id<"nodes"> | undefined}
					forkingFromPrompt={forkingFromPrompt}
				/>
			</SidebarInset>
		</SidebarProvider>
	);
}
