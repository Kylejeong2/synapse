import { useUser } from "@clerk/clerk-react"; // TODO: add sign in component back
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import {
	useAddToWaitlist,
	useConversations,
	useCreateConversation,
	useDeleteConversation,
} from "@/hooks/useConversation";
import { log } from "@/lib/logger";

export const Route = createFileRoute("/")({
	component: ConversationsPage,
});

function WaitlistPage() {
	const [email, setEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const addToWaitlist = useAddToWaitlist();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!email.trim()) {
			toast.error("Please enter your email");
			return;
		}

		setIsSubmitting(true);
		try {
			await addToWaitlist({ email: email.trim() });
			setIsSubmitted(true);
			setEmail("");
			toast.success("You're on the waitlist! We'll notify you soon.");
		} catch (error) {
			log.error(
				"Failed to add email to waitlist",
				error instanceof Error ? error : undefined,
				{ component: "WaitlistPage" },
			);
			toast.error(
				error instanceof Error && error.message.includes("Invalid email")
					? "Please enter a valid email address"
					: "Something went wrong. Please try again.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="flex flex-col items-center justify-center min-h-screen bg-background">
			<div className="relative w-full max-w-6xl px-4 py-16">
				{/* Hero Section */}
				<div className="text-center mb-20 space-y-6">
					<h1 className="text-7xl font-bold tracking-tight mb-4">
						<span className="text-foreground">Synapse</span>
					</h1>
					<p className="text-xl text-muted-foreground max-w-2xl mx-auto">
						Create branching conversations and explore ideas with AI
					</p>
				</div>

				{/* Waitlist Card */}
				<Card className="w-full max-w-md mx-auto border-2 border-primary/20 shadow-xl bg-card/80 backdrop-blur mb-8">
					<CardHeader className="text-center space-y-2 pb-6">
						<CardTitle className="text-2xl">Join the Waitlist</CardTitle>
						<CardDescription className="text-base">
							Be among the first to experience Synapse
						</CardDescription>
					</CardHeader>
					<CardContent className="pb-8">
						{isSubmitted ? (
							<div className="text-center space-y-4">
								<div className="text-green-600 dark:text-green-400 text-sm font-medium">
									You're on the list! We'll notify you when Synapse is ready.
								</div>
								<Button
									variant="outline"
									onClick={() => setIsSubmitted(false)}
									className="w-full"
								>
									Add Another Email
								</Button>
							</div>
						) : (
							<form onSubmit={handleSubmit} className="space-y-4">
								<Input
									type="email"
									placeholder="Enter your email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									disabled={isSubmitting}
									required
									className="w-full"
								/>
								<Button
									type="submit"
									disabled={isSubmitting || !email.trim()}
									className="w-full"
									size="lg"
								>
									{isSubmitting ? "Joining..." : "Join Waitlist"}
								</Button>
							</form>
						)}
					</CardContent>
				</Card>

				{/* Sign In Section */}
				{/* <div className="text-center mt-8">
					<p className="text-sm text-muted-foreground mb-4">
						Already have access?
					</p>
					<Card className="w-full max-w-md mx-auto border border-border/50">
						<CardContent className="pt-6">
							<SignIn />
						</CardContent>
					</Card>
				</div> */}
			</div>
		</div>
	);
}

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
			log.error(
				"Failed to create conversation",
				error instanceof Error ? error : undefined,
				{ component: "ConversationsPage" },
			);
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
			await deleteConversation({ conversationId });
		} catch (error) {
			log.error(
				"Failed to delete conversation",
				error instanceof Error ? error : undefined,
				{ conversationId, component: "ConversationsPage" },
			);
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
		return <WaitlistPage />;
	}

	return (
		<div className="min-h-screen overflow-y-auto bg-background">
			<div className="container mx-auto px-4 py-12">
				<div className="mb-12 flex items-center justify-between">
					<div>
						<h1 className="text-5xl font-bold mb-3 text-foreground">
							Your Conversations
						</h1>
						<p className="text-muted-foreground text-lg">
							Create branching conversations and explore ideas with AI
						</p>
					</div>
					<Button
						onClick={handleNewConversation}
						disabled={isCreating}
						size="lg"
						className="gap-2 shadow-lg"
					>
						<Plus className="h-5 w-5" />
						{isCreating ? "Creating..." : "New Conversation"}
					</Button>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{/* Existing Conversations */}
					{conversations?.map((conversation) => (
						<Card
							key={conversation._id}
							className="cursor-pointer hover:shadow-xl hover:shadow-primary/5 hover:border-primary/50 transition-all duration-300 relative group border-border/50 bg-card/50 backdrop-blur"
							onClick={() =>
								navigate({
									to: "/chat/$id",
									params: { id: conversation._id },
									search: { fromNode: undefined },
								})
							}
						>
							<CardHeader>
								<div className="flex justify-between items-start mb-3">
									<div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
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
					<div className="text-center py-20 text-muted-foreground">
						<div className="inline-flex h-16 w-16 rounded-xl border-2 border-dashed border-muted-foreground/30 items-center justify-center mb-6">
							<MessageSquare className="h-8 w-8 opacity-40" />
						</div>
						<p className="text-lg font-medium mb-2">No conversations yet</p>
						<p className="text-sm">Create one to get started!</p>
					</div>
				)}
			</div>
		</div>
	);
}
