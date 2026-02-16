import { mutation, query } from './_generated/server';
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

const invoicePaymentStatus = v.union(
	v.literal('paid'),
	v.literal('failed'),
	v.literal('open'),
);

async function upsertBillingCustomerMappingInternal(
	ctx: any,
	args: { userId: string; stripeCustomerId: string; email?: string },
) {
	const existingByUser = await ctx.db
		.query('billing_customers')
		.withIndex('userId', (q: any) => q.eq('userId', args.userId))
		.first();

	if (existingByUser) {
		await ctx.db.patch(existingByUser._id, {
			stripeCustomerId: args.stripeCustomerId,
			email: args.email,
			updatedAt: Date.now(),
		});
		return;
	}

	await ctx.db.insert('billing_customers', {
		userId: args.userId,
		stripeCustomerId: args.stripeCustomerId,
		email: args.email,
		updatedAt: Date.now(),
	});
}

/**
 * Enter webhook event processing state. Allows retries for failed events.
 */
export const beginWebhookEventProcessing = mutation({
	args: {
		eventId: v.string(),
		type: v.string(),
		createdAt: v.number(),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const existing = await ctx.db
			.query('stripe_events')
			.withIndex('eventId', (q) => q.eq('eventId', args.eventId))
			.first();

		if (!existing) {
			await ctx.db.insert('stripe_events', {
				eventId: args.eventId,
				type: args.type,
				createdAt: args.createdAt,
				status: 'processing',
				attempts: 1,
				lastAttemptAt: now,
			});
			return { proceed: true as const, state: 'new' as const };
		}

		if (existing.status === 'processed') {
			return { proceed: false as const, state: 'processed' as const };
		}

		await ctx.db.patch(existing._id, {
			status: 'processing',
			attempts: existing.attempts + 1,
			lastAttemptAt: now,
			lastError: undefined,
		});

		return { proceed: true as const, state: 'retry' as const };
	},
});

export const markWebhookEventProcessed = mutation({
	args: {
		eventId: v.string(),
	},
	handler: async (ctx, args) => {
		const event = await ctx.db
			.query('stripe_events')
			.withIndex('eventId', (q) => q.eq('eventId', args.eventId))
			.first();
		if (!event) return { success: false };

		await ctx.db.patch(event._id, {
			status: 'processed',
			processedAt: Date.now(),
			lastError: undefined,
		});

		const failure = await ctx.db
			.query('stripe_webhook_failures')
			.withIndex('eventId', (q) => q.eq('eventId', args.eventId))
			.first();
		if (failure && !failure.resolvedAt) {
			await ctx.db.patch(failure._id, {
				resolvedAt: Date.now(),
			});
		}

		return { success: true };
	},
});

export const markWebhookEventFailed = mutation({
	args: {
		eventId: v.string(),
		type: v.string(),
		error: v.string(),
		payload: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const event = await ctx.db
			.query('stripe_events')
			.withIndex('eventId', (q) => q.eq('eventId', args.eventId))
			.first();

		if (event) {
			await ctx.db.patch(event._id, {
				status: 'failed',
				lastError: args.error,
				lastAttemptAt: now,
			});
		}

		const existingFailure = await ctx.db
			.query('stripe_webhook_failures')
			.withIndex('eventId', (q) => q.eq('eventId', args.eventId))
			.first();

		if (existingFailure) {
			await ctx.db.patch(existingFailure._id, {
				lastSeenAt: now,
				lastError: args.error,
				retryCount: existingFailure.retryCount + 1,
				payload: args.payload,
				resolvedAt: undefined,
			});
		} else {
			await ctx.db.insert('stripe_webhook_failures', {
				eventId: args.eventId,
				type: args.type,
				payload: args.payload,
				firstSeenAt: now,
				lastSeenAt: now,
				retryCount: 1,
				lastError: args.error,
			});
		}

		await ctx.db.insert('billing_alerts', {
			source: 'webhook',
			severity: 'error',
			message: `Stripe webhook processing failed: ${args.type}`,
			context: JSON.stringify({
				eventId: args.eventId,
				error: args.error,
			}),
			createdAt: now,
		});

		return { success: true };
	},
});

/**
 * Upsert durable user <-> Stripe customer mapping.
 */
export const upsertBillingCustomerMapping = mutation({
	args: {
		userId: v.string(),
		stripeCustomerId: v.string(),
		email: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existingByUser = await ctx.db
			.query('billing_customers')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.first();

		await upsertBillingCustomerMappingInternal(ctx, args);
		return { action: existingByUser ? ('updated' as const) : ('inserted' as const) };
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
		cancelAtPeriodEnd: v.optional(v.boolean()),
		lastInvoicePaymentStatus: v.optional(invoicePaymentStatus),
		email: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await upsertBillingCustomerMappingInternal(ctx, {
			userId: args.userId,
			stripeCustomerId: args.stripeCustomerId,
			email: args.email,
		});

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
			cancelAtPeriodEnd: args.cancelAtPeriodEnd,
			lastInvoicePaymentStatus: args.lastInvoicePaymentStatus,
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

/**
 * Patch subscription by Stripe identifiers (invoice/webhook side effects).
 */
export const updateSubscriptionByStripeIds = mutation({
	args: {
		stripeSubscriptionId: v.optional(v.string()),
		stripeCustomerId: v.optional(v.string()),
		status: v.optional(subscriptionStatus),
		currentPeriodStart: v.optional(v.number()),
		currentPeriodEnd: v.optional(v.number()),
		cancelAtPeriodEnd: v.optional(v.boolean()),
		lastInvoicePaymentStatus: v.optional(invoicePaymentStatus),
	},
	handler: async (ctx, args) => {
		let subscription = null;
		if (args.stripeSubscriptionId) {
			subscription = await ctx.db
				.query('subscriptions')
				.withIndex('stripeSubscriptionId', (q) =>
					q.eq('stripeSubscriptionId', args.stripeSubscriptionId as string),
				)
				.first();
		}

		if (!subscription && args.stripeCustomerId) {
			subscription = await ctx.db
				.query('subscriptions')
				.withIndex('stripeCustomerId', (q) =>
					q.eq('stripeCustomerId', args.stripeCustomerId as string),
				)
				.first();
		}

		if (!subscription) {
			return { updated: false as const };
		}

		await ctx.db.patch(subscription._id, {
			status: args.status ?? subscription.status,
			currentPeriodStart:
				args.currentPeriodStart ?? subscription.currentPeriodStart,
			currentPeriodEnd: args.currentPeriodEnd ?? subscription.currentPeriodEnd,
			cancelAtPeriodEnd:
				args.cancelAtPeriodEnd ?? subscription.cancelAtPeriodEnd,
			lastInvoicePaymentStatus:
				args.lastInvoicePaymentStatus ?? subscription.lastInvoicePaymentStatus,
		});

		return { updated: true as const };
	},
});

export const listFailedWebhookEvents = query({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 100;
		return await ctx.db
			.query('stripe_webhook_failures')
			.filter((q) => q.eq(q.field('resolvedAt'), undefined))
			.order('desc')
			.take(limit);
	},
});

export const getUserIdByStripeCustomerId = query({
	args: {
		stripeCustomerId: v.string(),
	},
	handler: async (ctx, args) => {
		const mapping = await ctx.db
			.query('billing_customers')
			.withIndex('stripeCustomerId', (q) =>
				q.eq('stripeCustomerId', args.stripeCustomerId),
			)
			.first();
		return mapping?.userId ?? null;
	},
});

export const logBillingAlert = mutation({
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
		});
	},
});
