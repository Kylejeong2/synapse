import { mutation, query, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { stripe } from './stripe';

/**
 * Report usage to Stripe Metering API
 */
export const reportUsageToStripe = mutation({
	args: {
		userId: v.string(),
		billingCycleId: v.optional(v.id('billing_cycles')),
	},
	handler: async (ctx, args) => {
		const subscription = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.filter((q) => q.eq(q.field('status'), 'active'))
			.first();

		if (!subscription) {
			throw new Error('No active subscription found');
		}

		// Get billing cycle
		let billingCycle;
		if (args.billingCycleId) {
			billingCycle = await ctx.db.get(args.billingCycleId);
		} else {
			billingCycle = await ctx.db
				.query('billing_cycles')
				.withIndex('userId', (q) => q.eq('userId', args.userId))
				.filter((q) => q.eq(q.field('status'), 'active'))
				.first();
		}

		if (!billingCycle) {
			throw new Error('No active billing cycle found');
		}

		// Calculate overage (tokens used beyond included credit)
		// We report overage in dollars to Stripe
		const overageAmount = Math.max(
			0,
			billingCycle.tokenCost - billingCycle.includedCredit,
		);

		if (overageAmount <= 0) {
			// No overage to report
			return { reported: false, overageAmount: 0 };
		}

		// Report to Stripe Metering API
		// Note: Stripe metering expects quantity, so we convert dollars to a quantity
		// For simplicity, we'll report cents as the quantity
		const quantityInCents = Math.ceil(overageAmount * 100);

		// Retry logic for Stripe API failures
		const maxRetries = 3;
		let lastError: unknown;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				await stripe.billing.meterEvents.create({
					event_name: 'token_usage',
					payload: {
                        // Truncate to 2 decimal places
						value: quantityInCents.toFixed(2),
						identifier: subscription.stripeSubscriptionId,
					},
				});

				// Update billing cycle with Stripe invoice ID if available
				// (This would be set when invoice is created)

				return {
					reported: true,
					overageAmount,
					quantityInCents,
				};
			} catch (error) {
				lastError = error;
				console.error(
					`Failed to report usage to Stripe (attempt ${attempt + 1}/${maxRetries}):`,
					error,
				);

				// Don't retry on 4xx errors (client errors)
				if (
					error &&
					typeof error === 'object' &&
					'statusCode' in error &&
					typeof error.statusCode === 'number' &&
					error.statusCode >= 400 &&
					error.statusCode < 500
				) {
					throw error;
				}

				// Wait before retrying (exponential backoff)
				if (attempt < maxRetries - 1) {
					await new Promise((resolve) =>
						setTimeout(resolve, Math.pow(2, attempt) * 1000),
					);
				}
			}
		}

		// All retries failed
		console.error('Failed to report usage after all retries:', lastError);
		throw lastError;
	},
});

/**
 * Get or create billing cycle for current period
 */
export const getOrCreateBillingCycle = mutation({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const subscription = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.filter((q) => q.eq(q.field('status'), 'active'))
			.first();

		if (!subscription) {
			throw new Error('No active subscription found');
		}

		// Check for existing active billing cycle
		let billingCycle = await ctx.db
			.query('billing_cycles')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.filter((q) => q.eq(q.field('status'), 'active'))
			.first();

		// Check if cycle matches current subscription period
		if (
			billingCycle &&
			billingCycle.periodStart === subscription.currentPeriodStart &&
			billingCycle.periodEnd === subscription.currentPeriodEnd
		) {
			return billingCycle._id;
		}

		// Create new billing cycle
		const billingCycleId = await ctx.db.insert('billing_cycles', {
			userId: args.userId,
			subscriptionId: subscription._id,
			periodStart: subscription.currentPeriodStart,
			periodEnd: subscription.currentPeriodEnd,
			tokensUsed: 0,
			tokenCost: 0,
			includedCredit: subscription.includedTokenCredit,
			overageAmount: 0,
			status: 'active',
		});

		return billingCycleId;
	},
});

/**
 * Reset token credit for new billing cycle
 */
export const resetTokenCredit = internalMutation({
	args: {
		subscriptionId: v.id('subscriptions'),
	},
	handler: async (ctx, args) => {
		const subscription = await ctx.db.get(args.subscriptionId);
		if (!subscription) {
			throw new Error('Subscription not found');
		}

		// Mark old billing cycle as completed
		const oldCycle = await ctx.db
			.query('billing_cycles')
			.withIndex('subscriptionId', (q) =>
				q.eq('subscriptionId', args.subscriptionId),
			)
			.filter((q) => q.eq(q.field('status'), 'active'))
			.first();

		if (oldCycle) {
			await ctx.db.patch(oldCycle._id, {
				status: 'completed',
			});
		}

		// Create new billing cycle
		const newCycleId = await ctx.db.insert('billing_cycles', {
			userId: subscription.userId,
			subscriptionId: subscription._id,
			periodStart: subscription.currentPeriodStart,
			periodEnd: subscription.currentPeriodEnd,
			tokensUsed: 0,
			tokenCost: 0,
			includedCredit: subscription.includedTokenCredit,
			overageAmount: 0,
			status: 'active',
		});

		return newCycleId;
	},
});

/**
 * Get billing history for a user
 */
export const getBillingHistory = query({
	args: {
		userId: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 12; // Default to last 12 cycles
		const cycles = await ctx.db
			.query('billing_cycles')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.filter((q) => q.eq(q.field('status'), 'completed'))
			.order('desc')
			.take(limit);

		return cycles;
	},
});

/**
 * Clean up old usage records (older than 90 days)
 */
export const cleanupOldUsageRecords = mutation({
	args: {},
	handler: async (ctx) => {
		const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

		const oldRecords = await ctx.db
			.query('usage_records')
			.withIndex('timestamp', (q) => q.lt('timestamp', ninetyDaysAgo))
			.collect();

		let deletedCount = 0;
		for (const record of oldRecords) {
			await ctx.db.delete(record._id);
			deletedCount++;
		}

		return { deletedCount };
	},
});

