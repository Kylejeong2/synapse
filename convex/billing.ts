import { internalAction, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { MIN_OVERAGE_INVOICE_THRESHOLD_USD } from './pricing';
import { stripe } from './stripe';

/**
 * Process overage billing for expired billing cycles.
 *
 * This action runs on a cron schedule and:
 * 1. Finds all active billing cycles past their periodEnd
 * 2. For cycles with overage > threshold, creates a one-off Stripe invoice
 * 3. Marks all expired cycles as completed
 *
 * Idempotent: only processes cycles with status 'active'.
 * Error-isolated: one cycle failure doesn't block others.
 */
export const processOverageBilling = internalAction({
	handler: async (ctx): Promise<{ processed: number; invoiced: number; errors: number }> => {
		const expiredCycles: Array<{
			_id: Id<'billing_cycles'>;
			overageAmount: number;
			periodStart: number;
			periodEnd: number;
			stripeCustomerId: string;
		}> = await ctx.runQuery(internal.usage.getExpiredActiveCycles);

		if (expiredCycles.length === 0) {
			return { processed: 0, invoiced: 0, errors: 0 };
		}

		let invoiced = 0;
		let errors = 0;

		for (const cycle of expiredCycles) {
			try {
				const lockResult: { updated: boolean } = await ctx.runMutation(
					internal.usage.markBillingCyclePendingIfActive,
					{ billingCycleId: cycle._id },
				);
				if (!lockResult.updated) {
					continue;
				}

				if (cycle.overageAmount > MIN_OVERAGE_INVOICE_THRESHOLD_USD) {
					const amountCents = Math.round(cycle.overageAmount * 100);
					const periodStart = new Date(cycle.periodStart).toLocaleDateString();
					const periodEnd = new Date(cycle.periodEnd).toLocaleDateString();

					// Create an invoice item on the customer
					await stripe.invoiceItems.create({
						customer: cycle.stripeCustomerId,
						amount: amountCents,
						currency: 'usd',
						description: `Synapse token usage overage - billing period ${periodStart} to ${periodEnd}`,
					}, {
						idempotencyKey: `overage-item-${cycle._id}`,
					});

					// Create and auto-finalize the invoice
					const invoice = await stripe.invoices.create({
						customer: cycle.stripeCustomerId,
						collection_method: 'charge_automatically',
						auto_advance: true,
						metadata: {
							billingCycleId: cycle._id,
							type: 'overage',
						},
					}, {
						idempotencyKey: `overage-invoice-${cycle._id}`,
					});

					await ctx.runMutation(internal.usage.completeBillingCycle, {
						billingCycleId: cycle._id,
						stripeInvoiceId: invoice.id,
					});

					invoiced++;
				} else {
					// No meaningful overage, just mark as completed
					await ctx.runMutation(internal.usage.completeBillingCycle, {
						billingCycleId: cycle._id,
					});
				}
			} catch (error) {
				errors++;
				await ctx.runMutation(internal.usage.setBillingCycleStatus, {
					billingCycleId: cycle._id,
					status: 'active',
				});
				await ctx.runMutation(internal.billing.logBillingAlert, {
					source: 'overage_cron',
					severity: 'error',
					message: `Failed overage billing for cycle ${cycle._id}`,
					context: JSON.stringify({
						billingCycleId: cycle._id,
						error: error instanceof Error ? error.message : String(error),
					}),
				});
				console.error(
					`Failed to process overage billing for cycle ${cycle._id}:`,
					error instanceof Error ? error.message : String(error),
				);
			}
		}

		return {
			processed: expiredCycles.length,
			invoiced,
			errors,
		};
	},
});

/**
 * Reconcile pending cycles that may be left behind after partial failures.
 *
 * For each pending cycle:
 * - if an invoice with metadata.billingCycleId exists in Stripe, mark cycle completed.
 * - otherwise reset to active so normal overage processing can retry safely.
 */
export const reconcilePendingOverageBilling = internalAction({
	handler: async (
		ctx,
	): Promise<{ scanned: number; completed: number; resetToActive: number; errors: number }> => {
		const pendingCycles: Array<{
			_id: Id<'billing_cycles'>;
			stripeCustomerId: string;
		}> = await ctx.runQuery(internal.usage.getPendingCycles);

		let completed = 0;
		let resetToActive = 0;
		let errors = 0;

		for (const cycle of pendingCycles) {
			try {
				const invoices = await stripe.invoices.list({
					customer: cycle.stripeCustomerId,
					limit: 25,
				});

				const matchedInvoice = invoices.data.find(
					(invoice) => invoice.metadata?.billingCycleId === cycle._id,
				);

				if (matchedInvoice) {
					await ctx.runMutation(internal.usage.completeBillingCycle, {
						billingCycleId: cycle._id,
						stripeInvoiceId: matchedInvoice.id,
					});
					completed++;
				} else {
					await ctx.runMutation(internal.usage.setBillingCycleStatus, {
						billingCycleId: cycle._id,
						status: 'active',
					});
					resetToActive++;
				}
			} catch (error) {
				errors++;
				await ctx.runMutation(internal.billing.logBillingAlert, {
					source: 'overage_cron',
					severity: 'error',
					message: `Failed pending-cycle reconciliation for ${cycle._id}`,
					context: JSON.stringify({
						billingCycleId: cycle._id,
						error: error instanceof Error ? error.message : String(error),
					}),
				});
			}
		}

		return {
			scanned: pendingCycles.length,
			completed,
			resetToActive,
			errors,
		};
	},
});

export const logBillingAlert = internalMutation({
	args: {
		source: v.union(
			v.literal('webhook'),
			v.literal('overage_cron'),
			v.literal('invoice'),
		),
		severity: v.union(
			v.literal('info'),
			v.literal('warning'),
			v.literal('error'),
		),
		message: v.string(),
		context: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert('billing_alerts', {
			source: args.source,
			severity: args.severity,
			message: args.message,
			context: args.context,
			createdAt: Date.now(),
			notificationAttempts: 0,
		});
	},
});
