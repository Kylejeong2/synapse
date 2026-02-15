import { useUser } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Zap } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/pricing")({
	component: PricingPage,
});

function PricingPage() {
	const { user, isSignedIn } = useUser();
	const navigate = useNavigate();
	const [isLoading, setIsLoading] = useState(false);

	const handleSubscribe = async () => {
		if (!isSignedIn || !user?.id) {
			navigate({ to: "/" });
			return;
		}

		setIsLoading(true);
		try {
			const response = await fetch("/api/create-checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: user.id,
					userEmail: user.primaryEmailAddress?.emailAddress,
				}),
			});

			const data = await response.json();
			if (data.url) {
				window.location.href = data.url;
			} else {
				throw new Error(data.error || "Failed to create checkout session");
			}
		} catch (error) {
			console.error("Error creating checkout:", error);
			alert("Failed to start checkout. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="container mx-auto py-12 px-4">
			<div className="text-center mb-12">
				<h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
				<p className="text-muted-foreground text-lg">
					Start free, upgrade when you need more
				</p>
			</div>

			<div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
				{/* Free Tier */}
				<Card>
					<CardHeader>
						<CardTitle>Free</CardTitle>
						<CardDescription>Perfect for trying out Synapse</CardDescription>
						<div className="mt-4">
							<span className="text-4xl font-bold">$0</span>
							<span className="text-muted-foreground">/month</span>
						</div>
					</CardHeader>
					<CardContent>
						<ul className="space-y-3 mb-6">
							<li className="flex items-start gap-2">
								<Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
								<span>1 conversation</span>
							</li>
							<li className="flex items-start gap-2">
								<Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
								<span>20,000 tokens</span>
							</li>
							<li className="flex items-start gap-2">
								<Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
								<span>All AI models</span>
							</li>
							<li className="flex items-start gap-2">
								<Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
								<span>Conversation branching</span>
							</li>
						</ul>
						<Button variant="outline" className="w-full" disabled>
							Current Plan
						</Button>
					</CardContent>
				</Card>

				{/* Paid Tier */}
				<Card className="border-primary">
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle>Pro</CardTitle>
							<Badge>Popular</Badge>
						</div>
						<CardDescription>For power users and teams</CardDescription>
						<div className="mt-4">
							<span className="text-4xl font-bold">$20</span>
							<span className="text-muted-foreground">/month</span>
						</div>
					</CardHeader>
					<CardContent>
						<ul className="space-y-3 mb-6">
							<li className="flex items-start gap-2">
								<Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
								<span>Unlimited conversations</span>
							</li>
							<li className="flex items-start gap-2">
								<Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
								<span>$10 token credit included</span>
							</li>
							<li className="flex items-start gap-2">
								<Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
								<span>Usage-based pricing after credit</span>
							</li>
							<li className="flex items-start gap-2">
								<Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
								<span>All AI models</span>
							</li>
							<li className="flex items-start gap-2">
								<Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
								<span>Priority support</span>
							</li>
						</ul>
						<Button
							className="w-full"
							onClick={handleSubscribe}
							disabled={isLoading}
						>
							{isLoading ? "Loading..." : "Subscribe"}
						</Button>
						<p className="text-xs text-muted-foreground mt-2 text-center">
							After $10 credit, pay only for what you use
						</p>
					</CardContent>
				</Card>
			</div>

			<div className="mt-12 max-w-2xl mx-auto">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Zap className="h-5 w-5" />
							Usage-Based Pricing
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground mb-4">
							After your $10 monthly credit is used, you'll be charged based on
							actual token usage. Pricing varies by model:
						</p>
						<ul className="space-y-2 text-sm">
							<li>
								• Premium models (GPT-5, Claude Opus): higher per‑token rates
							</li>
							<li>
								• Standard models (Claude Sonnet): mid‑range per‑token rates
							</li>
							<li>• Efficient models (Claude Haiku): lowest per‑token rates</li>
						</ul>
						<p className="text-xs text-muted-foreground mt-4">
							Overage charges are accumulated and billed at the end of your
							billing cycle.
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
