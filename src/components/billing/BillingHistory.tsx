import { useQuery } from "@tanstack/react-query";
import { ConvexHttpClient } from "convex/browser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "../../../convex/_generated/api";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "";
const convexClient = new ConvexHttpClient(CONVEX_URL);

interface BillingHistoryProps {
	userId: string;
}

export function BillingHistory({ userId }: BillingHistoryProps) {
	const { data: history } = useQuery({
		queryKey: ["billingHistory", userId],
		queryFn: async () => {
			return await convexClient.query(api.billing_cycles.getBillingHistory, {
				userId,
				limit: 12,
			});
		},
		enabled: !!userId,
	});

	if (!history || history.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Billing History</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground">No billing history yet</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Billing History</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{history.map((cycle) => {
						const periodStart = new Date(cycle.periodStart);
						const periodEnd = new Date(cycle.periodEnd);
						return (
							<div
								key={cycle._id}
								className="flex items-center justify-between py-2 border-b last:border-0"
							>
								<div>
									<p className="font-medium">
										{periodStart.toLocaleDateString()} -{" "}
										{periodEnd.toLocaleDateString()}
									</p>
									<p className="text-sm text-muted-foreground">
										{cycle.tokensUsed.toLocaleString()} tokens • $
										{cycle.tokenCost.toFixed(2)}
									</p>
								</div>
								<div className="text-right">
									<p className="font-medium">
										${(cycle.tokenCost - cycle.includedCredit).toFixed(2)}
									</p>
									<p className="text-xs text-muted-foreground">Overage</p>
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
