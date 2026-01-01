import { mutation } from './_generated/server';
import { api, internal } from './_generated/api';
import { stripe } from './stripe';
import { v } from 'convex/values';

/**
 * Handle subscription created event
 */
export const handleSubscriptionCreated = mutation({
	args: {
		subscription: v.any(), // Stripe.Subscription
	},
	handler: async (ctx, args) => {
		const subscription = args.subscription;
		let clerkUserId = subscription.metadata?.clerkUserId;

		if (!clerkUserId) {
			console.error('Missing clerkUserId in subscription metadata');
			// Try to find user by customer ID as fallback
			const customer = await stripe.customers.retrieve(
				subscription.customer as string,
			);
			if (
				!('metadata' in customer) ||
				!customer.metadata?.clerkUserId
			) {
				console.error(
					'Could not find clerkUserId in subscription or customer metadata',
				);
				return;
			}
			clerkUserId = customer.metadata.clerkUserId;
		}

		// Check if subscription already exists
		const existing = await ctx.db
			.query('subscriptions')
			.withIndex('stripeSubscriptionId', (q) =>
				q.eq('stripeSubscriptionId', subscription.id),
			)
			.first();

		if (existing) {
			// Update existing
			await ctx.db.patch(existing._id, {
				status: subscription.status as any,
				currentPeriodStart: subscription.current_period_start * 1000,
				currentPeriodEnd: subscription.current_period_end * 1000,
			});
			return;
		}

		// Create new subscription record
		await ctx.db.insert('subscriptions', {
			userId: clerkUserId,
			stripeCustomerId: subscription.customer as string,
			stripeSubscriptionId: subscription.id,
			status: subscription.status as any,
			currentPeriodStart: subscription.current_period_start * 1000,
			currentPeriodEnd: subscription.current_period_end * 1000,
			includedTokenCredit: 10, // $10 credit
			planType: 'paid',
		});
	},
});

/**
 * Handle subscription updated event
 */
export const handleSubscriptionUpdated = mutation({
	args: {
		subscription: v.any(), // Stripe.Subscription
	},
	handler: async (ctx, args) => {
		const subscription = args.subscription;

		const existing = await ctx.db
			.query('subscriptions')
			.withIndex('stripeSubscriptionId', (q) =>
				q.eq('stripeSubscriptionId', subscription.id),
			)
			.first();

		if (!existing) {
			console.error('Subscription not found for update:', subscription.id);
			return;
		}

		await ctx.db.patch(existing._id, {
			status: subscription.status as any,
			currentPeriodStart: subscription.current_period_start * 1000,
			currentPeriodEnd: subscription.current_period_end * 1000,
		});

		// If billing period changed, reset credit
		if (
			existing.currentPeriodStart !== subscription.current_period_start * 1000
		) {
			await ctx.scheduler.runAfter(
				0,
				internal.billing.resetTokenCredit,
				{ subscriptionId: existing._id },
			);
		}
	},
});

/**
 * Handle subscription deleted event
 */
export const handleSubscriptionDeleted = mutation({
	args: {
		subscription: v.any(), // Stripe.Subscription
	},
	handler: async (ctx, args) => {
		const subscription = args.subscription;

		const existing = await ctx.db
			.query('subscriptions')
			.withIndex('stripeSubscriptionId', (q) =>
				q.eq('stripeSubscriptionId', subscription.id),
			)
			.first();

		if (!existing) {
			console.error('Subscription not found for deletion:', subscription.id);
			return;
		}

		await ctx.db.patch(existing._id, {
			status: 'canceled',
		});
	},
});

/**
 * Handle invoice payment succeeded event
 */
export const handleInvoicePaymentSucceeded = mutation({
	args: {
		invoice: v.any(), // Stripe.Invoice
	},
	handler: async (ctx, args) => {
		const invoice = args.invoice;
		const subscriptionId = invoice.subscription as string;

		if (!subscriptionId) {
			return; // Not a subscription invoice
		}

		const subscription = await ctx.db
			.query('subscriptions')
			.withIndex('stripeSubscriptionId', (q) =>
				q.eq('stripeSubscriptionId', subscriptionId),
			)
			.first();

		if (!subscription) {
			console.error('Subscription not found for invoice:', subscriptionId);
			return;
		}

		// Update billing cycle with invoice ID
		const billingCycle = await ctx.db
			.query('billing_cycles')
			.withIndex('subscriptionId', (q) =>
				q.eq('subscriptionId', subscription._id),
			)
			.filter((q) => q.eq(q.field('status'), 'active'))
			.first();

		if (billingCycle) {
			await ctx.db.patch(billingCycle._id, {
				stripeInvoiceId: invoice.id,
			});
		}

		// Reset token credit for new billing period
		await ctx.scheduler.runAfter(
			0,
			internal.billing.resetTokenCredit,
			{ subscriptionId: subscription._id },
		);
	},
});

/**
 * Handle invoice payment failed event
 */
export const handleInvoicePaymentFailed = mutation({
	args: {
		invoice: v.any(), // Stripe.Invoice
	},
	handler: async (ctx, args) => {
		const invoice = args.invoice;
		const subscriptionId = invoice.subscription as string;

		if (!subscriptionId) {
			return; // Not a subscription invoice
		}

		const subscription = await ctx.db
			.query('subscriptions')
			.withIndex('stripeSubscriptionId', (q) =>
				q.eq('stripeSubscriptionId', subscriptionId),
			)
			.first();

		if (!subscription) {
			console.error('Subscription not found for failed invoice:', subscriptionId);
			return;
		}

		// Update subscription status to past_due
		await ctx.db.patch(subscription._id, {
			status: 'past_due',
		});

		// TODO: Implement grace period logic
		// For now, we just mark as past_due
	},
});

