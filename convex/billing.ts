import { internalAction } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
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
