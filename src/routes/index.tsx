import { SignIn, useUser } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	MessageSquare,
	Plus,
	Trash2,
	GitBranch,
	Network,
	Zap,
} from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	useConversations,
	useCreateConversation,
	useDeleteConversation,
} from "@/hooks/useConversation";

export const Route = createFileRoute("/")({
	component: ConversationsPage,
});

function ConversationsPage() {
	const { user, isSignedIn, isLoaded } = useUser();
	const navigate = useNavigate();
	const conversations = useConversations(user?.id);
	const createConversation = useCreateConversation();
	const deleteConversation = useDeleteConversation();
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

	const handleDeleteConversation = async (
		conversationId: string,
		e: React.MouseEvent,
	) => {
		e.stopPropagation();
		try {
			await deleteConversation({ conversationId: conversationId as any });
		} catch (error) {
			console.error("Failed to delete conversation:", error);
		}
	};

	const formatRelativeTime = (timestamp: number) => {
		const now = Date.now();
		const diff = now - timestamp;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return "just now";
	};

	if (!isLoaded) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-muted-foreground">Loading...</div>
			</div>
		);
	}

	if (!isSignedIn) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen bg-linear-to-br from-background via-muted/30 to-background">
				<div className="absolute inset-0 bg-grid-slate-100 mask-[linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25" />
				<div className="relative w-full max-w-6xl px-4 py-16">
					{/* Hero Section */}
					<div className="text-center mb-16 space-y-6">
						<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
							<MessageSquare className="h-4 w-4" />
							<span>AI-Powered Conversation Trees</span>
						</div>
						<h1 className="text-6xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
							Synapse
						</h1>
						<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
							Fork conversations, explore multiple paths, and visualize your AI
							interactions in an intuitive tree structure
						</p>
					</div>

					{/* Features Grid */}
					<div className="grid md:grid-cols-3 gap-6 mb-16">
						<Card className="border-2 hover:border-primary/50 transition-colors">
							<CardHeader>
								<div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
									<GitBranch className="h-6 w-6 text-primary" />
								</div>
								<CardTitle>Branch & Fork</CardTitle>
								<CardDescription>
									Create multiple conversation paths from any point. Explore
									different ideas without losing context.
								</CardDescription>
							</CardHeader>
						</Card>
						<Card className="border-2 hover:border-primary/50 transition-colors">
							<CardHeader>
								<div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
									<Network className="h-6 w-6 text-primary" />
								</div>
								<CardTitle>Visual Tree</CardTitle>
								<CardDescription>
									See your entire conversation history as an interactive flow
									diagram. Navigate with ease.
								</CardDescription>
							</CardHeader>
						</Card>
						<Card className="border-2 hover:border-primary/50 transition-colors">
							<CardHeader>
								<div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
									<Zap className="h-6 w-6 text-primary" />
								</div>
								<CardTitle>Context Tracking</CardTitle>
								<CardDescription>
									Track token usage across conversation chains. See exactly how
									much context you're using.
								</CardDescription>
							</CardHeader>
						</Card>
					</div>

					{/* Sign In Card */}
					<Card className="w-full max-w-md mx-auto">
						<CardHeader className="text-center">
							<CardTitle>Get Started</CardTitle>
							<CardDescription>
								Sign in to start creating conversation trees
							</CardDescription>
						</CardHeader>
						<CardContent>
							<SignIn />
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen overflow-y-auto bg-linear-to-br from-background via-muted/20 to-background">
			<div className="container mx-auto px-4 py-8">
				<div className="mb-8 flex items-center justify-between">
					<div>
						<h1 className="text-4xl font-bold mb-2 bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
							Your Conversations
						</h1>
						<p className="text-muted-foreground">
							Create branching conversations and explore ideas with AI
						</p>
					</div>
					<Button
						onClick={handleNewConversation}
						disabled={isCreating}
						size="lg"
						className="gap-2"
					>
						<Plus className="h-5 w-5" />
						{isCreating ? "Creating..." : "New Conversation"}
					</Button>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{/* Existing Conversations */}
					{conversations?.map((conversation: any) => (
						<Card
							key={conversation._id}
							className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all relative group"
							onClick={() =>
								navigate({
									to: "/chat/$id",
									params: { id: conversation._id },
									search: { fromNode: undefined },
								})
							}
						>
							<CardHeader>
								<div className="flex justify-between items-start mb-2">
									<div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
										<MessageSquare className="h-5 w-5 text-primary" />
									</div>
									<div className="flex gap-2 items-center">
										<Badge variant="secondary" className="text-xs">
											{conversation.nodeCount} nodes
										</Badge>
										<AlertDialog>
											<AlertDialogTrigger
												asChild
												onClick={(e) => e.stopPropagation()}
											>
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6 opacity-0 group-hover:opacity-100 transition"
												>
													<Trash2 className="h-4 w-4 text-destructive" />
												</Button>
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>
														Delete conversation?
													</AlertDialogTitle>
													<AlertDialogDescription>
														This will permanently delete this conversation and
														all its messages. This action cannot be undone.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>Cancel</AlertDialogCancel>
													<AlertDialogAction
														onClick={(e) =>
															handleDeleteConversation(conversation._id, e)
														}
														className="bg-destructive text-white hover:bg-destructive/90"
													>
														Delete
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</div>
								</div>
								<CardTitle className="line-clamp-2">
									{conversation.title}
								</CardTitle>
								<CardDescription>
									{formatRelativeTime(conversation.lastAccessedAt)}
								</CardDescription>
							</CardHeader>
						</Card>
					))}
				</div>

				{conversations && conversations.length === 0 && (
					<div className="text-center py-12 text-muted-foreground">
						<MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
						<p>No conversations yet. Create one to get started!</p>
					</div>
				)}
			</div>
		</div>
	);
}
