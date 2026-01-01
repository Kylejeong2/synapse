import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { BillingHistory } from "@/components/billing/BillingHistory";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { UsageChart } from "@/components/billing/UsageChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "../../convex/_generated/api";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "";
const convexClient = new ConvexHttpClient(CONVEX_URL);

export const Route = createFileRoute("/billing")({
	component: BillingPage,
});

function BillingPage() {
	const { user, isSignedIn } = useUser();

	const { data: subscription } = useQuery({
		queryKey: ["subscription", user?.id],
		queryFn: async () => {
			if (!user?.id) return null;
			return await convexClient.query(api.subscriptions.getSubscription, {
				userId: user.id,
			});
		},
		enabled: !!user?.id,
	});

	const { data: usageStats } = useQuery({
		queryKey: ["usageStats", user?.id],
		queryFn: async () => {
			if (!user?.id) return null;
			return await convexClient.query(api.rateLimiting.getUsageStats, {
				userId: user.id,
			});
		},
		enabled: !!user?.id,
	});

	const getCustomerPortalUrl = useMutation({
		mutationFn: async () => {
			if (!user?.id) throw new Error("Not signed in");
			return await convexClient.mutation(
				api.subscriptions.getCustomerPortalUrl,
				{
					userId: user.id,
				},
			);
		},
		onSuccess: (data) => {
			if (data.url) {
				window.location.href = data.url;
			}
		},
	});

	if (!isSignedIn) {
		return (
			<div className="container mx-auto py-12 px-4">
				<Card>
					<CardHeader>
						<CardTitle>Sign In Required</CardTitle>
					</CardHeader>
					<CardContent>
						<p>Please sign in to view your billing information.</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto py-12 px-4 max-w-6xl">
			<h1 className="text-3xl font-bold mb-8">Billing & Usage</h1>

			<div className="grid gap-6">
				{/* Subscription Status */}
				<SubscriptionCard subscription={subscription || undefined} />

				{/* Usage Stats */}
				{usageStats && (
					<Card>
						<CardHeader>
							<CardTitle>Usage This Month</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid md:grid-cols-3 gap-4 mb-4">
								<div>
									<p className="text-sm text-muted-foreground">Tokens Used</p>
									<p className="text-2xl font-bold">
										{usageStats.tier === "paid"
											? usageStats.tokensUsed.toLocaleString()
											: `${usageStats.tokensUsed.toLocaleString()} / ${usageStats.maxTokens?.toLocaleString()}`}
									</p>
								</div>
								{usageStats.tier === "paid" && (
									<>
										<div>
											<p className="text-sm text-muted-foreground">
												Credit Remaining
											</p>
											<p className="text-2xl font-bold">
												${usageStats.remainingCredit?.toFixed(2) || "0.00"}
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">Overage</p>
											<p className="text-2xl font-bold">
												${usageStats.overageAmount?.toFixed(2) || "0.00"}
											</p>
										</div>
									</>
								)}
							</div>
							<UsageChart userId={user?.id || ""} />
						</CardContent>
					</Card>
				)}

				{/* Billing History */}
				{subscription && <BillingHistory userId={user?.id || ""} />}

				{/* Manage Subscription */}
				{subscription && (
					<Card>
						<CardHeader>
							<CardTitle>Manage Subscription</CardTitle>
						</CardHeader>
						<CardContent>
							<Button
								onClick={() => getCustomerPortalUrl.mutate()}
								disabled={getCustomerPortalUrl.isPending}
							>
								{getCustomerPortalUrl.isPending
									? "Loading..."
									: "Manage Payment Method"}
							</Button>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
