import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { stripe, getStripePriceId } from './stripe';

/**
 * Create a Stripe Checkout session for subscription
 */
export const createCheckoutSession = mutation({
	args: {
		userId: v.string(),
		userEmail: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check if user already has an active subscription
		const existingSubscription = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.filter((q) => q.eq(q.field('status'), 'active'))
			.first();

		if (existingSubscription) {
			throw new Error('User already has an active subscription');
		}

		// Get or create Stripe customer
		let customerId: string;

		// Try to find existing customer by userId metadata
		const existingCustomers = await stripe.customers.list({
			limit: 100,
		});

		const existingCustomer = existingCustomers.data.find(
			(c) => c.metadata?.clerkUserId === args.userId,
		);

		if (existingCustomer) {
			customerId = existingCustomer.id;
		} else {
			// Create new Stripe customer
			const customer = await stripe.customers.create({
				email: args.userEmail,
				metadata: {
					clerkUserId: args.userId,
				},
			});
			customerId = customer.id;
		}

		// Create checkout session
		const session = await stripe.checkout.sessions.create({
			customer: customerId,
			line_items: [
				{
			price: getStripePriceId(),
				},
			],
			mode: 'subscription',
			success_url: `${process.env.SERVER_URL || 'http://localhost:3000'}/pricing?success=true`,
			cancel_url: `${process.env.SERVER_URL || 'http://localhost:3000'}/pricing?canceled=true`,
			metadata: {
				clerkUserId: args.userId,
			},
		});

		return {
			sessionId: session.id,
			url: session.url,
		};
	},
});
