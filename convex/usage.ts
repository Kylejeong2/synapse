import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { isBillingEntitledSubscriptionStatus } from './subscriptionStatus';
import { requireAuthenticatedUserId } from './auth';

/**
 * Record token usage for a request
 */
export const recordUsage = mutation({
	args: {
		conversationId: v.id('conversations'),
		nodeId: v.id('nodes'),
		model: v.string(),
		tokensUsed: v.number(),
		inputTokens: v.optional(v.number()),
		outputTokens: v.optional(v.number()),
		thinkingTokens: v.optional(v.number()),
		tokenCost: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			throw new Error('Conversation not found');
		}
		if (conversation.userId !== userId) {
			throw new Error('Forbidden');
		}
		const node = await ctx.db.get(args.nodeId);
		if (!node || node.conversationId !== args.conversationId) {
			throw new Error('Node not found');
		}

		const timestamp = Date.now();
		const inputTokens = args.inputTokens ?? 0;
		const outputTokens = args.outputTokens ?? 0;
		const thinkingTokens = args.thinkingTokens ?? 0;

		const pricing = await ctx.db
			.query('token_pricing')
			.withIndex('model', (q) => q.eq('model', args.model))
			.filter((q) => q.eq(q.field('isActive'), true))
			.first();

		const effectiveTokenCost = pricing
			? inputTokens * pricing.pricePerTokenInput +
				outputTokens * pricing.pricePerTokenOutput +
				thinkingTokens * (pricing.pricePerTokenThinking ?? pricing.pricePerTokenOutput)
			: args.tokenCost;

		if (effectiveTokenCost === undefined) {
			throw new Error(
				`Cannot determine token cost for model '${args.model}'. Add active token_pricing data or pass tokenCost.`,
			);
		}

		// Get or create current billing cycle for paid users
		const subscription = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.first();
		const entitledSubscription =
			subscription && isBillingEntitledSubscriptionStatus(subscription.status)
				? subscription
				: null;

		let billingCycleId: string | undefined;

		if (entitledSubscription) {
			// Find or create active billing cycle
			let billingCycle = await ctx.db
				.query('billing_cycles')
				.withIndex('userId', (q) => q.eq('userId', userId))
				.filter((q) => q.eq(q.field('status'), 'active'))
				.first();

			if (
				!billingCycle ||
				billingCycle.periodStart < entitledSubscription.currentPeriodStart ||
				billingCycle.periodEnd > entitledSubscription.currentPeriodEnd
			) {
				// Create new billing cycle
				billingCycleId = await ctx.db.insert('billing_cycles', {
					userId,
					subscriptionId: entitledSubscription._id,
					periodStart: entitledSubscription.currentPeriodStart,
					periodEnd: entitledSubscription.currentPeriodEnd,
					tokensUsed: 0,
					tokenCost: 0,
					includedCredit: entitledSubscription.includedTokenCredit,
					overageAmount: 0,
					status: 'active',
				});
			} else {
				billingCycleId = billingCycle._id;
			}

			// Update billing cycle totals
			await ctx.db.patch(billingCycleId as any, {
				tokensUsed: (billingCycle?.tokensUsed || 0) + args.tokensUsed,
				tokenCost: (billingCycle?.tokenCost || 0) + effectiveTokenCost,
				overageAmount: Math.max(
					0,
					(billingCycle?.tokenCost || 0) +
						effectiveTokenCost -
						(billingCycle?.includedCredit ||
							entitledSubscription.includedTokenCredit),
				),
			});
		} else {
			// Free tier: Update free_tier_usage
			const freeTierUsage = await ctx.db
				.query('free_tier_usage')
				.withIndex('conversationId', (q) =>
					q.eq('conversationId', args.conversationId),
				)
				.first();

			if (freeTierUsage) {
				await ctx.db.patch(freeTierUsage._id, {
					tokensUsed: freeTierUsage.tokensUsed + args.tokensUsed,
				});
			} else {
				// Create new free tier usage record
				await ctx.db.insert('free_tier_usage', {
					userId,
					conversationId: args.conversationId,
					tokensUsed: args.tokensUsed,
					createdAt: timestamp,
					isLocked: true,
				});
			}
		}

		// Record usage in usage_records
		await ctx.db.insert('usage_records', {
			userId,
			conversationId: args.conversationId,
			nodeId: args.nodeId,
			model: args.model,
			tokensUsed: args.tokensUsed,
			tokenCost: effectiveTokenCost,
			timestamp,
			billingCycleId: billingCycleId as any,
		});

		return { success: true };
	},
});

/**
 * Get usage records for a user
 */
export const getUserUsageRecords = query({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const limit = args.limit || 100;
		const records = await ctx.db
			.query('usage_records')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.order('desc')
			.take(limit);

		return records;
	},
});

/**
 * Get usage records for a conversation
 */
export const getConversationUsage = query({
	args: {
		conversationId: v.id('conversations'),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			return {
				records: [],
				totalTokens: 0,
				totalCost: 0,
			};
		}
		if (conversation.userId !== userId) {
			throw new Error('Forbidden');
		}

		const records = await ctx.db
			.query('usage_records')
			.withIndex('conversationId', (q) =>
				q.eq('conversationId', args.conversationId),
			)
			.collect();

		const totalTokens = records.reduce(
			(sum, record) => sum + record.tokensUsed,
			0,
		);
		const totalCost = records.reduce(
			(sum, record) => sum + record.tokenCost,
			0,
		);

		return {
			records,
			totalTokens,
			totalCost,
		};
	},
});

/**
 * Get current billing cycle usage
 */
export const getCurrentCycleUsage = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const billingCycle = await ctx.db
			.query('billing_cycles')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.filter((q) => q.eq(q.field('status'), 'active'))
			.first();

		if (!billingCycle) {
			return null;
		}

		// Get all usage records for this cycle
		const records = await ctx.db
			.query('usage_records')
			.withIndex('billingCycleId', (q) =>
				q.eq('billingCycleId', billingCycle._id),
			)
			.collect();

		return {
			billingCycle,
			records,
		};
	},
});

/**
 * Aggregate usage by billing cycle
 */
export const aggregateUsageByCycle = query({
	args: {
		billingCycleId: v.id('billing_cycles'),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const billingCycle = await ctx.db.get(args.billingCycleId);
		if (!billingCycle || billingCycle.userId !== userId) {
			throw new Error('Forbidden');
		}
		const records = await ctx.db
			.query('usage_records')
			.withIndex('billingCycleId', (q) =>
				q.eq('billingCycleId', args.billingCycleId),
			)
			.collect();

		const totalTokens = records.reduce(
			(sum, record) => sum + record.tokensUsed,
			0,
		);
		const totalCost = records.reduce(
			(sum, record) => sum + record.tokenCost,
			0,
		);

		// Group by model
		const byModel = records.reduce(
			(acc, record) => {
				if (!acc[record.model]) {
					acc[record.model] = { tokens: 0, cost: 0 };
				}
				acc[record.model].tokens += record.tokensUsed;
				acc[record.model].cost += record.tokenCost;
				return acc;
			},
			{} as Record<string, { tokens: number; cost: number }>,
		);

		return {
			totalTokens,
			totalCost,
			byModel,
			recordCount: records.length,
		};
	},
});

/**
 * Get cumulative token usage for a conversation (for free tier limit checking)
 */
export const getConversationTokenTotal = query({
	args: {
		conversationId: v.id('conversations'),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation || conversation.userId !== userId) {
			throw new Error('Forbidden');
		}

		const freeTierUsage = await ctx.db
			.query('free_tier_usage')
			.withIndex('conversationId', (q) =>
				q.eq('conversationId', args.conversationId),
			)
			.first();

		if (freeTierUsage) {
			return freeTierUsage.tokensUsed;
		}

		// Fallback: sum from usage_records
		const records = await ctx.db
			.query('usage_records')
			.withIndex('conversationId', (q) =>
				q.eq('conversationId', args.conversationId),
			)
			.collect();

		return records.reduce((sum, record) => sum + record.tokensUsed, 0);
	},
});

/**
 * Find all active billing cycles that have expired (periodEnd < now).
 * Joins with subscriptions to include the stripeCustomerId for Stripe API calls.
 * Used by the overage billing cron job.
 */
export const getExpiredActiveCycles = internalQuery({
	handler: async (ctx) => {
		const now = Date.now();
		const activeCycles = await ctx.db
			.query('billing_cycles')
			.filter((q) => q.eq(q.field('status'), 'active'))
			.collect();

		const expired = [];
		for (const cycle of activeCycles) {
			if (cycle.periodEnd > now) continue;
			const subscription = await ctx.db.get(cycle.subscriptionId);
			if (!subscription) continue;
			expired.push({
				...cycle,
				stripeCustomerId: subscription.stripeCustomerId,
			});
		}
		return expired;
	},
});

export const getPendingCycles = internalQuery({
	handler: async (ctx) => {
		const pendingCycles = await ctx.db
			.query('billing_cycles')
			.filter((q) => q.eq(q.field('status'), 'pending'))
			.collect();

		const result = [];
		for (const cycle of pendingCycles) {
			const subscription = await ctx.db.get(cycle.subscriptionId);
			if (!subscription) continue;
			result.push({
				...cycle,
				stripeCustomerId: subscription.stripeCustomerId,
			});
		}
		return result;
	},
});

/**
 * Mark a billing cycle as completed and optionally store the Stripe invoice ID.
 * Called by the overage billing action after processing.
 */
export const completeBillingCycle = internalMutation({
	args: {
		billingCycleId: v.id('billing_cycles'),
		stripeInvoiceId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.billingCycleId, {
			status: 'completed',
			stripeInvoiceId: args.stripeInvoiceId,
		});
	},
});

/**
 * Transition a billing cycle to pending iff it is currently active.
 * Used as a lightweight lock before creating Stripe invoice artifacts.
 */
export const markBillingCyclePendingIfActive = internalMutation({
	args: {
		billingCycleId: v.id('billing_cycles'),
	},
	handler: async (ctx, args) => {
		const cycle = await ctx.db.get(args.billingCycleId);
		if (!cycle || cycle.status !== 'active') {
			return { updated: false };
		}

		await ctx.db.patch(args.billingCycleId, {
			status: 'pending',
		});
		return { updated: true };
	},
});

/**
 * Set billing cycle status explicitly (e.g. to recover pending->active on failure).
 */
export const setBillingCycleStatus = internalMutation({
	args: {
		billingCycleId: v.id('billing_cycles'),
		status: v.union(
			v.literal('active'),
			v.literal('pending'),
			v.literal('completed'),
		),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.billingCycleId, {
			status: args.status,
		});
	},
});
