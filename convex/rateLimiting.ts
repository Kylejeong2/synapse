import { query } from './_generated/server';
import { v } from 'convex/values';
import {
	DEFAULT_INCLUDED_TOKEN_CREDIT_USD,
	FREE_TIER_MAX_CONVERSATIONS,
	FREE_TIER_MAX_TOKENS,
	PAID_TIER_ESTIMATED_COST_PER_1K_TOKENS_USD,
} from './pricing';

/**
 * Check if user can make a request (rate limiting)
 * Returns true if user can proceed, false if rate limited
 */
export const checkRateLimit = query({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		// Check if user has active subscription
		const subscription = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.filter((q) => q.eq(q.field('status'), 'active'))
			.first();

		// Paid users have no rate limits (only token credit limits)
		if (subscription) {
			return { allowed: true, reason: 'paid_tier' };
		}

		// Free tier users can always make requests (but have conversation/token limits)
		return { allowed: true, reason: 'free_tier' };
	},
});

/**
 * Check if user has enough token credit for a request
 * Returns true if user can proceed, false if credit exceeded
 */
export const checkTokenLimit = query({
	args: {
		userId: v.string(),
		requestedTokens: v.optional(v.number()), // Estimated tokens for this request
	},
	handler: async (ctx, args) => {
		const { userId, requestedTokens = 0 } = args;

		// Check if user has active subscription
		const subscription = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.filter((q) => q.eq(q.field('status'), 'active'))
			.first();

		if (subscription) {
			// Paid tier: Check token credit
			const currentCycle = await ctx.db
				.query('billing_cycles')
				.withIndex('userId', (q) => q.eq('userId', userId))
				.filter((q) => q.eq(q.field('status'), 'active'))
				.first();

			const includedCredit =
				subscription.includedTokenCredit ?? DEFAULT_INCLUDED_TOKEN_CREDIT_USD;

			if (!currentCycle) {
				// No active cycle, allow (will be created on first usage)
				return { allowed: true, remainingCredit: includedCredit };
			}

			const totalCost = currentCycle.tokenCost;
			const remainingCredit = includedCredit - totalCost;

			// Estimate cost for requested tokens (rough estimate in USD per 1k tokens)
			const estimatedCost =
				(requestedTokens / 1000) * PAID_TIER_ESTIMATED_COST_PER_1K_TOKENS_USD;

			if (remainingCredit - estimatedCost < 0) {
				return {
					allowed: false,
					reason: 'credit_exceeded',
					remainingCredit,
					estimatedCost,
				};
			}

			return {
				allowed: true,
				remainingCredit,
				estimatedCost,
			};
		}

		// Free tier: Check token limit
		const freeTierUsage = await ctx.db
			.query('free_tier_usage')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.collect();

		const totalTokensUsed = freeTierUsage.reduce(
			(sum, usage) => sum + usage.tokensUsed,
			0,
		);

		if (totalTokensUsed + requestedTokens > FREE_TIER_MAX_TOKENS) {
			return {
				allowed: false,
				reason: 'free_tier_limit_exceeded',
				tokensUsed: totalTokensUsed,
				maxTokens: FREE_TIER_MAX_TOKENS,
			};
		}

		return {
			allowed: true,
			tokensUsed: totalTokensUsed,
			maxTokens: FREE_TIER_MAX_TOKENS,
		};
	},
});

/**
 * Get usage statistics for a user
 */
export const getUsageStats = query({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		// Check if user has active subscription
		const subscription = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.filter((q) => q.eq(q.field('status'), 'active'))
			.first();

		if (subscription) {
			// Paid tier stats
			const currentCycle = await ctx.db
				.query('billing_cycles')
				.withIndex('userId', (q) => q.eq('userId', args.userId))
				.filter((q) => q.eq(q.field('status'), 'active'))
				.first();

			if (!currentCycle) {
				return {
					tier: 'paid',
					tokensUsed: 0,
					tokenCost: 0,
					remainingCredit:
						subscription.includedTokenCredit ??
						DEFAULT_INCLUDED_TOKEN_CREDIT_USD,
					includedCredit:
						subscription.includedTokenCredit ??
						DEFAULT_INCLUDED_TOKEN_CREDIT_USD,
					overageAmount: 0,
					periodStart: subscription.currentPeriodStart,
					periodEnd: subscription.currentPeriodEnd,
				};
			}

			const overageAmount = Math.max(
				0,
				currentCycle.tokenCost - currentCycle.includedCredit,
			);

			return {
				tier: 'paid',
				tokensUsed: currentCycle.tokensUsed,
				tokenCost: currentCycle.tokenCost,
					remainingCredit: Math.max(
						0,
						currentCycle.includedCredit - currentCycle.tokenCost,
					),
					includedCredit: currentCycle.includedCredit,
				overageAmount,
				periodStart: currentCycle.periodStart,
				periodEnd: currentCycle.periodEnd,
			};
		}

		// Free tier stats
		const freeTierUsage = await ctx.db
			.query('free_tier_usage')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.collect();

		const conversations = await ctx.db
			.query('conversations')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.filter((q) => q.eq(q.field('isFreeTier'), true))
			.collect();

		const totalTokensUsed = freeTierUsage.reduce(
			(sum, usage) => sum + usage.tokensUsed,
			0,
		);

		return {
			tier: 'free',
			tokensUsed: totalTokensUsed,
			maxTokens: FREE_TIER_MAX_TOKENS,
			conversationsUsed: conversations.length,
			maxConversations: FREE_TIER_MAX_CONVERSATIONS,
		};
	},
});

/**
 * Check if user is on free tier
 */
export const isFreeTier = query({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const subscription = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.filter((q) => q.eq(q.field('status'), 'active'))
			.first();

		return !subscription;
	},
});
