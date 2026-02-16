import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { DEFAULT_INCLUDED_TOKEN_CREDIT_USD } from './pricing';

const subscriptionStatus = v.union(
	v.literal('active'),
	v.literal('canceled'),
	v.literal('past_due'),
	v.literal('unpaid'),
	v.literal('incomplete'),
	v.literal('incomplete_expired'),
	v.literal('paused'),
	v.literal('trialing'),
);

/**
 * Persist Stripe webhook event id for idempotency.
 * Returns false if this event has already been processed.
 */
export const registerWebhookEvent = mutation({
	args: {
		eventId: v.string(),
		type: v.string(),
		createdAt: v.number(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('stripe_events')
			.withIndex('eventId', (q) => q.eq('eventId', args.eventId))
			.first();

		if (existing) {
			return { accepted: false as const };
		}

		await ctx.db.insert('stripe_events', {
			eventId: args.eventId,
			type: args.type,
			createdAt: args.createdAt,
			processedAt: Date.now(),
		});

		return { accepted: true as const };
	},
});

/**
 * Upsert subscription state from Stripe events.
 */
export const upsertSubscriptionFromStripe = mutation({
	args: {
		userId: v.string(),
		stripeCustomerId: v.string(),
		stripeSubscriptionId: v.string(),
		status: subscriptionStatus,
		currentPeriodStart: v.number(),
		currentPeriodEnd: v.number(),
		includedTokenCredit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const existingBySub = await ctx.db
			.query('subscriptions')
			.withIndex('stripeSubscriptionId', (q) =>
				q.eq('stripeSubscriptionId', args.stripeSubscriptionId),
			)
			.first();

		const existingByUser = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.first();

		const includedTokenCredit =
			args.includedTokenCredit ?? DEFAULT_INCLUDED_TOKEN_CREDIT_USD;

		const payload = {
			userId: args.userId,
			stripeCustomerId: args.stripeCustomerId,
			stripeSubscriptionId: args.stripeSubscriptionId,
			status: args.status,
			currentPeriodStart: args.currentPeriodStart,
			currentPeriodEnd: args.currentPeriodEnd,
			includedTokenCredit,
			planType: 'paid' as const,
		};

		if (existingBySub) {
			await ctx.db.patch(existingBySub._id, payload);
			return { action: 'updated_by_subscription' as const };
		}

		if (existingByUser) {
			await ctx.db.patch(existingByUser._id, payload);
			return { action: 'updated_by_user' as const };
		}

		await ctx.db.insert('subscriptions', payload);
		return { action: 'inserted' as const };
	},
});
