import { useUser } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
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
import {
	FREE_TIER_MAX_CONVERSATIONS,
	FREE_TIER_MAX_TOKENS,
	PRO_INCLUDED_TOKEN_CREDIT_USD,
	PRO_MONTHLY_PRICE_USD,
} from "@/lib/constants/pricing";

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
		<div className="flex flex-col items-center min-h-screen bg-background px-4 py-16">
			<div className="w-full max-w-6xl">
				{/* Hero Section */}
				<div className="text-center mb-20 space-y-6">
					<h1 className="text-6xl md:text-7xl font-bold tracking-tight text-foreground">
						Choose Your Plan
					</h1>
					<p className="text-muted-foreground text-xl max-w-2xl mx-auto">
						Start free, upgrade when you need more
					</p>
				</div>

				{/* Pricing Cards */}
				<div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
					{/* Free Tier */}
					<Card className="border-border/50 bg-card/50 backdrop-blur hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300">
						<CardHeader className="pb-6">
							<CardTitle className="text-2xl">Free</CardTitle>
							<CardDescription className="text-base">
								Perfect for trying out Synapse
							</CardDescription>
							<div className="mt-6">
								<span className="text-5xl font-bold tracking-tight">$0</span>
								<span className="text-muted-foreground text-lg ml-1">
									/month
								</span>
							</div>
						</CardHeader>
						<CardContent>
							<ul className="space-y-4 mb-8">
								<li className="flex items-start gap-3">
									<div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 mt-0.5">
										<Check className="h-3.5 w-3.5 text-primary" />
									</div>
									<span className="text-sm text-foreground">
										{FREE_TIER_MAX_CONVERSATIONS} conversation
										{FREE_TIER_MAX_CONVERSATIONS === 1 ? "" : "s"}
									</span>
								</li>
								<li className="flex items-start gap-3">
									<div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 mt-0.5">
										<Check className="h-3.5 w-3.5 text-primary" />
									</div>
									<span className="text-sm text-foreground">
										{FREE_TIER_MAX_TOKENS.toLocaleString()} tokens
									</span>
								</li>
								<li className="flex items-start gap-3">
									<div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 mt-0.5">
										<Check className="h-3.5 w-3.5 text-primary" />
									</div>
									<span className="text-sm text-foreground">All AI models</span>
								</li>
								<li className="flex items-start gap-3">
									<div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 mt-0.5">
										<Check className="h-3.5 w-3.5 text-primary" />
									</div>
									<span className="text-sm text-foreground">
										Conversation branching
									</span>
								</li>
							</ul>
							<Button variant="outline" className="w-full h-11" disabled>
								Current Plan
							</Button>
						</CardContent>
					</Card>

					{/* Pro Tier */}
					<Card className="border-2 border-primary/40 bg-card/80 backdrop-blur shadow-xl shadow-primary/10 hover:shadow-2xl hover:shadow-primary/15 hover:border-primary/60 transition-all duration-300">
						<CardHeader className="pb-6">
							<div className="flex items-center justify-between">
								<CardTitle className="text-2xl">Pro</CardTitle>
								<Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold">
									Popular
								</Badge>
							</div>
							<CardDescription className="text-base">
								For power users and teams
							</CardDescription>
							<div className="mt-6">
								<span className="text-5xl font-bold tracking-tight">
									${PRO_MONTHLY_PRICE_USD}
								</span>
								<span className="text-muted-foreground text-lg ml-1">
									/month
								</span>
							</div>
						</CardHeader>
						<CardContent>
							<ul className="space-y-4 mb-8">
								<li className="flex items-start gap-3">
									<div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 mt-0.5">
										<Check className="h-3.5 w-3.5 text-primary" />
									</div>
									<span className="text-sm text-foreground">
										Unlimited conversations
									</span>
								</li>
								<li className="flex items-start gap-3">
									<div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 mt-0.5">
										<Check className="h-3.5 w-3.5 text-primary" />
									</div>
									<span className="text-sm text-foreground">
										${PRO_INCLUDED_TOKEN_CREDIT_USD} token credit included
									</span>
								</li>
								<li className="flex items-start gap-3">
									<div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 mt-0.5">
										<Check className="h-3.5 w-3.5 text-primary" />
									</div>
									<span className="text-sm text-foreground">
										Usage-based pricing after credit
									</span>
								</li>
								<li className="flex items-start gap-3">
									<div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 mt-0.5">
										<Check className="h-3.5 w-3.5 text-primary" />
									</div>
									<span className="text-sm text-foreground">All AI models</span>
								</li>
								<li className="flex items-start gap-3">
									<div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0 mt-0.5">
										<Check className="h-3.5 w-3.5 text-primary" />
									</div>
									<span className="text-sm text-foreground">
										Priority support
									</span>
								</li>
							</ul>
							<Button
								className="w-full h-11 shadow-lg"
								onClick={handleSubscribe}
								disabled={isLoading}
							>
								{isLoading ? "Loading..." : "Subscribe"}
							</Button>
							<p className="text-xs text-muted-foreground mt-3 text-center">
								After ${PRO_INCLUDED_TOKEN_CREDIT_USD} credit, pay only for what
								you use
							</p>
						</CardContent>
					</Card>
				</div>

			</div>
		</div>
	);
}
