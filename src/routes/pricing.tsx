import { useAuth, useUser } from "@clerk/clerk-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
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
import {
	FREE_TIER_MAX_CONVERSATIONS,
	FREE_TIER_MAX_TOKENS,
	PRO_INCLUDED_TOKEN_CREDIT_USD,
	PRO_MONTHLY_PRICE_USD,
} from "@/lib/constants/pricing";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/pricing")({
	component: PricingPage,
});

function PricingPage() {
	const { user, isSignedIn } = useUser();
	const { getToken } = useAuth();
	const navigate = useNavigate();
	const [isLoading, setIsLoading] = useState(false);
	const [isManagingBilling, setIsManagingBilling] = useState(false);
	const [spendCapInput, setSpendCapInput] = useState("");
	const usageStats = useQuery(
		api.rateLimiting.getUsageStats,
		user?.id ? {} : "skip",
	);
	const billingSettings = useQuery(
		api.subscriptions.getBillingSettings,
		user?.id ? {} : "skip",
	);

	const loadBillingToken = async () => {
		const token = await getToken();
		if (!token) {
			throw new Error("No auth token available");
		}
		return token;
	};

	const handleSubscribe = async () => {
		if (!isSignedIn || !user?.id) {
			navigate({ to: "/" });
			return;
		}

		setIsLoading(true);
		try {
			const token = await getToken();
			if (!token) {
				throw new Error("No auth token available");
			}

			const response = await fetch("/api/create-checkout", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
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

	const callBillingApi = async (
		path: string,
		payload?: Record<string, unknown>,
	) => {
		const token = await loadBillingToken();
		const response = await fetch(path, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(payload ?? {}),
		});
		const data = await response.json();
		if (!response.ok) {
			throw new Error(data.error || "Billing request failed");
		}
		return data;
	};

	const handleOpenBillingPortal = async () => {
		setIsManagingBilling(true);
		try {
			const data = await callBillingApi("/api/billing-portal");
			if (data.url) {
				window.location.href = data.url;
				return;
			}
			throw new Error("Missing billing portal URL");
		} catch (error) {
			console.error("Error opening billing portal:", error);
			alert("Failed to open billing portal. Please try again.");
		} finally {
			setIsManagingBilling(false);
		}
	};

	const handleCancelSubscription = async () => {
		setIsManagingBilling(true);
		try {
			await callBillingApi("/api/subscription-cancel");
			alert(
				"Subscription will cancel at the end of the current billing period.",
			);
		} catch (error) {
			console.error("Error canceling subscription:", error);
			alert("Failed to update subscription cancellation.");
		} finally {
			setIsManagingBilling(false);
		}
	};

	const handleResumeSubscription = async () => {
		setIsManagingBilling(true);
		try {
			await callBillingApi("/api/subscription-resume");
			alert("Subscription cancellation removed.");
		} catch (error) {
			console.error("Error resuming subscription:", error);
			alert("Failed to resume subscription.");
		} finally {
			setIsManagingBilling(false);
		}
	};

	const handleSaveSpendCap = async () => {
		setIsManagingBilling(true);
		try {
			const normalizedValue = spendCapInput.trim();
			const monthlySpendCap =
				normalizedValue.length === 0 ? undefined : Number(normalizedValue);
			if (
				monthlySpendCap !== undefined &&
				(Number.isNaN(monthlySpendCap) || monthlySpendCap < 0)
			) {
				throw new Error("Spend cap must be a non-negative number.");
			}
			await callBillingApi("/api/subscription-spend-cap", { monthlySpendCap });
			alert("Spend cap updated.");
		} catch (error) {
			console.error("Error updating spend cap:", error);
			alert(
				error instanceof Error ? error.message : "Failed to update spend cap.",
			);
		} finally {
			setIsManagingBilling(false);
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
								<span>
									{FREE_TIER_MAX_CONVERSATIONS} conversation
									{FREE_TIER_MAX_CONVERSATIONS === 1 ? "" : "s"}
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Check className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
								<span>{FREE_TIER_MAX_TOKENS.toLocaleString()} tokens</span>
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
							<span className="text-4xl font-bold">
								${PRO_MONTHLY_PRICE_USD}
							</span>
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
								<span>
									${PRO_INCLUDED_TOKEN_CREDIT_USD} token credit included
								</span>
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
							After ${PRO_INCLUDED_TOKEN_CREDIT_USD} credit, pay only for what
							you use
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
							After your ${PRO_INCLUDED_TOKEN_CREDIT_USD} monthly credit is
							used, you'll be charged based on actual token usage. Pricing
							varies by model:
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

			{usageStats?.tier === "paid" && (
				<div className="mt-8 max-w-2xl mx-auto">
					<Card>
						<CardHeader>
							<CardTitle>Manage Billing</CardTitle>
							<CardDescription>
								Portal access, subscription status, and monthly spend cap.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="text-sm text-muted-foreground">
								Current spend: ${usageStats.tokenCost?.toFixed(2) ?? "0.00"}
								{" · "}
								Included credit: $
								{usageStats.includedCredit?.toFixed(2) ?? "0.00"}
							</div>
							<div className="text-sm text-muted-foreground">
								Status: {billingSettings?.status ?? "unknown"}
								{billingSettings?.cancelAtPeriodEnd
									? " (canceling at period end)"
									: ""}
							</div>
							<div className="flex gap-2 flex-wrap">
								<Button
									variant="outline"
									onClick={handleOpenBillingPortal}
									disabled={isManagingBilling}
								>
									Open Billing Portal
								</Button>
								{billingSettings?.cancelAtPeriodEnd ? (
									<Button
										variant="outline"
										onClick={handleResumeSubscription}
										disabled={isManagingBilling}
									>
										Resume Subscription
									</Button>
								) : (
									<Button
										variant="outline"
										onClick={handleCancelSubscription}
										disabled={isManagingBilling}
									>
										Cancel at Period End
									</Button>
								)}
							</div>
							<div className="flex gap-2 items-center">
								<input
									type="number"
									min={0}
									step="0.01"
									className="h-9 rounded-md border bg-background px-3 text-sm"
									placeholder="Monthly spend cap (USD)"
									value={spendCapInput}
									onChange={(e) => setSpendCapInput(e.target.value)}
								/>
								<Button
									variant="secondary"
									onClick={handleSaveSpendCap}
									disabled={isManagingBilling}
								>
									Save Spend Cap
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
}
