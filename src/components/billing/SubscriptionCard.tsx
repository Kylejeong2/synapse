import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Id } from "../../../convex/_generated/dataModel";

interface SubscriptionCardProps {
	subscription?: {
		_id: Id<"subscriptions">;
		status: string;
		currentPeriodStart: number;
		currentPeriodEnd: number;
		includedTokenCredit: number;
	} | null;
}

export function SubscriptionCard({ subscription }: SubscriptionCardProps) {
	if (!subscription) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Current Plan</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground">Free Tier</p>
					<p className="text-sm mt-2">
						Upgrade to Pro for unlimited conversations and $10 token credit.
					</p>
				</CardContent>
			</Card>
		);
	}

	const periodStart = new Date(subscription.currentPeriodStart);
	const periodEnd = new Date(subscription.currentPeriodEnd);

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle>Current Plan</CardTitle>
					<Badge
						variant={subscription.status === "active" ? "default" : "secondary"}
					>
						{subscription.status}
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					<p className="text-2xl font-bold">Pro</p>
					<p className="text-muted-foreground">
						${subscription.includedTokenCredit} token credit included per month
					</p>
					<div className="mt-4 pt-4 border-t">
						<p className="text-sm text-muted-foreground">Billing Period</p>
						<p className="text-sm">
							{periodStart.toLocaleDateString()} -{" "}
							{periodEnd.toLocaleDateString()}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
