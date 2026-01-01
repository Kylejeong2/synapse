import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";

interface UpgradePromptProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	reason: "conversation_limit" | "token_limit" | "delete_conversation";
}

export function UpgradePrompt({
	open,
	onOpenChange,
	reason,
}: UpgradePromptProps) {
	const { isSignedIn } = useUser();
	const navigate = useNavigate();

	const handleUpgrade = () => {
		onOpenChange(false);
		if (isSignedIn) {
			navigate({ to: "/pricing" });
		} else {
			navigate({ to: "/" });
		}
	};

	const getContent = () => {
		switch (reason) {
			case "conversation_limit":
				return {
					title: "Upgrade to Create More Conversations",
					description:
						"You've reached the free tier limit of 1 conversation. Upgrade to Pro to create unlimited conversations and unlock advanced features.",
					features: [
						"Unlimited conversations",
						"$10 token credit included monthly",
						"Usage-based pricing after credit",
						"Full conversation management",
					],
				};
			case "token_limit":
				return {
					title: "Upgrade to Continue Using Synapse",
					description:
						"You've reached the free tier token limit of 20,000 tokens. Upgrade to Pro to continue using Synapse with unlimited tokens.",
					features: [
						"$10 token credit included monthly",
						"Unlimited tokens",
						"Usage-based pricing after credit",
						"Priority support",
					],
				};
			case "delete_conversation":
				return {
					title: "Upgrade to Manage Conversations",
					description:
						"Free tier conversations cannot be deleted. Upgrade to Pro to unlock full conversation management features.",
					features: [
						"Delete and manage conversations",
						"Unlimited conversations",
						"$10 token credit included monthly",
						"Full control over your data",
					],
				};
		}
	};

	const content = getContent();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<div className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-primary" />
						<DialogTitle>{content.title}</DialogTitle>
					</div>
					<DialogDescription>{content.description}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="bg-muted/50 rounded-lg p-4">
						<div className="text-sm font-semibold mb-2">Pro Plan Includes:</div>
						<ul className="space-y-2">
							{content.features.map((feature) => (
								<li key={feature} className="flex items-start gap-2 text-sm">
									<span className="text-primary mt-0.5">•</span>
									<span>{feature}</span>
								</li>
							))}
						</ul>
					</div>

					<div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
						<div className="flex items-center justify-between">
							<div>
								<div className="text-sm font-semibold">Pro Plan</div>
								<div className="text-xs text-muted-foreground">
									$20/month • $10 token credit included
								</div>
							</div>
							<div className="text-2xl font-bold">$20</div>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Maybe Later
					</Button>
					<Button onClick={handleUpgrade} className="gap-2">
						<Sparkles className="h-4 w-4" />
						Upgrade to Pro
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
