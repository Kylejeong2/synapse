import { internal } from './_generated/api';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';

export const listPendingBillingAlerts = internalQuery({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 50;
		return await ctx.db
			.query('billing_alerts')
			.withIndex('resolvedAt', (q) => q.eq('resolvedAt', undefined))
			.filter((q) =>
				q.or(q.eq(q.field('severity'), 'warning'), q.eq(q.field('severity'), 'error')),
			)
			.order('desc')
			.take(limit);
	},
});

export const markBillingAlertNotified = internalMutation({
	args: {
		alertId: v.id('billing_alerts'),
	},
	handler: async (ctx, args) => {
		const alert = await ctx.db.get(args.alertId);
		if (!alert) return;
		await ctx.db.patch(args.alertId, {
			notifiedAt: Date.now(),
			notificationAttempts: (alert.notificationAttempts ?? 0) + 1,
			lastNotificationError: undefined,
		});
	},
});

export const markBillingAlertNotificationFailed = internalMutation({
	args: {
		alertId: v.id('billing_alerts'),
		error: v.string(),
	},
	handler: async (ctx, args) => {
		const alert = await ctx.db.get(args.alertId);
		if (!alert) return;
		await ctx.db.patch(args.alertId, {
			notificationAttempts: (alert.notificationAttempts ?? 0) + 1,
			lastNotificationError: args.error,
		});
	},
});

/**
 * Dispatch billing alerts to an external incident webhook.
 * Set BILLING_ALERT_WEBHOOK_URL to enable delivery.
 */
export const dispatchBillingAlerts = internalAction({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const webhookUrl = process.env.BILLING_ALERT_WEBHOOK_URL;
		if (!webhookUrl) {
			return { sent: 0, failed: 0, skipped: true as const };
		}

		const alerts = await ctx.runQuery((internal as any).billingAlerts.listPendingBillingAlerts, {
			limit: args.limit ?? 25,
		});

		let sent = 0;
		let failed = 0;
		for (const alert of alerts) {
			if (alert.notifiedAt) continue;

			try {
				const response = await fetch(webhookUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						source: 'synapse-billing',
						severity: alert.severity,
						message: alert.message,
						context: alert.context,
						createdAt: alert.createdAt,
					}),
				});

				if (!response.ok) {
					throw new Error(`Webhook returned ${response.status}`);
				}

				await ctx.runMutation((internal as any).billingAlerts.markBillingAlertNotified, {
					alertId: alert._id,
				});
				sent++;
			} catch (error) {
				failed++;
				await ctx.runMutation(
					(internal as any).billingAlerts.markBillingAlertNotificationFailed,
					{
						alertId: alert._id,
						error: error instanceof Error ? error.message : String(error),
					},
				);
			}
		}

		return { sent, failed, skipped: false as const };
	},
});
