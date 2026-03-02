type BillingAlertSource = 'webhook' | 'overage_cron' | 'invoice';
type BillingAlertSeverity = 'info' | 'warning' | 'error';

export async function insertBillingAlert(
	ctx: any,
	args: {
		source: BillingAlertSource;
		severity: BillingAlertSeverity;
		message: string;
		context?: string;
		createdAt?: number;
	},
): Promise<void> {
	await ctx.db.insert('billing_alerts', {
		source: args.source,
		severity: args.severity,
		message: args.message,
		context: args.context,
		createdAt: args.createdAt ?? Date.now(),
		notificationAttempts: 0,
	});
}
