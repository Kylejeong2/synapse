import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { api } from './_generated/api';

/**
 * Record token usage for a request
 */
export const recordUsage = mutation({
	args: {
		userId: v.string(),
		conversationId: v.id('conversations'),
		nodeId: v.id('nodes'),
		model: v.string(),
		tokensUsed: v.number(),
		tokenCost: v.number(),
	},
	handler: async (ctx, args) => {
		const timestamp = Date.now();

		// Get or create current billing cycle for paid users
		const subscription = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.filter((q) => q.eq(q.field('status'), 'active'))
			.first();

		let billingCycleId: string | undefined;

		if (subscription) {
			// Find or create active billing cycle
			let billingCycle = await ctx.db
				.query('billing_cycles')
				.withIndex('userId', (q) => q.eq('userId', args.userId))
				.filter((q) => q.eq(q.field('status'), 'active'))
				.first();

			if (
				!billingCycle ||
				billingCycle.periodStart < subscription.currentPeriodStart ||
				billingCycle.periodEnd > subscription.currentPeriodEnd
			) {
				// Create new billing cycle
				billingCycleId = await ctx.db.insert('billing_cycles', {
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
			} else {
				billingCycleId = billingCycle._id;
			}

			// Update billing cycle totals
			await ctx.db.patch(billingCycleId as any, {
				tokensUsed: (billingCycle?.tokensUsed || 0) + args.tokensUsed,
				tokenCost: (billingCycle?.tokenCost || 0) + args.tokenCost,
				overageAmount: Math.max(
					0,
					(billingCycle?.tokenCost || 0) +
						args.tokenCost -
						(billingCycle?.includedCredit || subscription.includedTokenCredit),
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
					userId: args.userId,
					conversationId: args.conversationId,
					tokensUsed: args.tokensUsed,
					createdAt: timestamp,
					isLocked: true,
				});
			}
		}

		// Record usage in usage_records
		await ctx.db.insert('usage_records', {
			userId: args.userId,
			conversationId: args.conversationId,
			nodeId: args.nodeId,
			model: args.model,
			tokensUsed: args.tokensUsed,
			tokenCost: args.tokenCost,
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
		userId: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 100;
		const records = await ctx.db
			.query('usage_records')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
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
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const billingCycle = await ctx.db
			.query('billing_cycles')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
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
		userId: v.string(),
		billingCycleId: v.id('billing_cycles'),
	},
	handler: async (ctx, args) => {
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

