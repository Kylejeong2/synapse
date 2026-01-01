import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../../convex/_generated/api";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../ui/card";

interface UsageChartProps {
	userId: string;
}

export function UsageChart({ userId }: UsageChartProps) {
	const cycleUsage = useQuery(api.usage.getCurrentCycleUsage, { userId });

	const chartData = useMemo(() => {
		if (!cycleUsage?.records || cycleUsage.records.length === 0) {
			return { data: [] as number[], maxValue: 0 };
		}

		const { billingCycle, records } = cycleUsage;
		const periodStart = billingCycle.periodStart;
		const periodEnd = billingCycle.periodEnd;
		const periodDuration = periodEnd - periodStart;

		// Group records by day
		const dailyUsage = new Map<number, number>();

		records.forEach((record) => {
			const day = Math.floor(
				((record.timestamp - periodStart) / periodDuration) * 30,
			);
			const dayKey = Math.min(29, Math.max(0, day)); // Clamp to 0-29 (30 days)
			const current = dailyUsage.get(dayKey) || 0;
			dailyUsage.set(dayKey, current + record.tokenCost);
		});

		// Create array of 30 data points
		const data: number[] = [];
		let maxValue = 0;

		for (let i = 0; i < 30; i++) {
			const value = dailyUsage.get(i) || 0;
			data.push(value);
			maxValue = Math.max(maxValue, value);
		}

		return { data, maxValue };
	}, [cycleUsage]);

	if (!cycleUsage) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Usage This Month</CardTitle>
					<CardDescription>Loading usage data...</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	const { billingCycle } = cycleUsage;
	const periodStartDate = new Date(billingCycle.periodStart);
	const periodEndDate = new Date(billingCycle.periodEnd);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Usage This Month</CardTitle>
				<CardDescription>
					{periodStartDate.toLocaleDateString()} -{" "}
					{periodEndDate.toLocaleDateString()}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{chartData.data.length === 0 ? (
					<div className="flex items-center justify-center h-48 text-muted-foreground">
						No usage data yet
					</div>
				) : (
					<div className="space-y-4">
						{/* Chart visualization */}
						<div className="h-48 flex items-end gap-1">
							{chartData.data.map((value: number, index: number) => {
								const height =
									chartData.maxValue > 0
										? (value / chartData.maxValue) * 100
										: 0;
								return (
									<div
										key={`day-${index}-${value}`}
										className="flex-1 bg-primary/20 rounded-t hover:bg-primary/30 transition-colors relative group"
										style={{ height: `${Math.max(height, 2)}%` }}
									>
										<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover border rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
											${value.toFixed(2)}
										</div>
									</div>
								);
							})}
						</div>

						{/* Summary stats */}
						<div className="grid grid-cols-3 gap-4 pt-4 border-t">
							<div>
								<div className="text-sm text-muted-foreground">Total Cost</div>
								<div className="text-lg font-semibold">
									${billingCycle.tokenCost.toFixed(2)}
								</div>
							</div>
							<div>
								<div className="text-sm text-muted-foreground">Credit Used</div>
								<div className="text-lg font-semibold">
									$
									{Math.min(
										billingCycle.tokenCost,
										billingCycle.includedCredit,
									).toFixed(2)}{" "}
									/ ${billingCycle.includedCredit.toFixed(2)}
								</div>
							</div>
							<div>
								<div className="text-sm text-muted-foreground">Overage</div>
								<div className="text-lg font-semibold">
									${billingCycle.overageAmount.toFixed(2)}
								</div>
							</div>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
