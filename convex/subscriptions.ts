import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { DEFAULT_INCLUDED_TOKEN_CREDIT_USD, PRO_MONTHLY_PRICE_USD } from './pricing';
import { stripe, getStripePriceId } from './stripe';
import { isOpenBillingSubscriptionStatus } from './subscriptionStatus';
import { requireAuthenticatedUserId } from './auth';

let validatedPriceId: string | null = null;

function getServerUrl(): string {
	const configured = process.env.SERVER_URL;
	if (configured) return configured;
	if (process.env.NODE_ENV === 'production') {
		throw new Error('SERVER_URL environment variable is required in production');
	}
	return 'http://localhost:3000';
}

async function assertStripeSubscriptionPriceMatchesCatalog(): Promise<void> {
	const priceId = getStripePriceId();
	if (validatedPriceId === priceId) return;

	const price = await stripe.prices.retrieve(priceId);
	if (!price.active) {
		throw new Error(`Stripe price '${priceId}' is not active`);
	}
	if (!price.recurring) {
		throw new Error(`Stripe price '${priceId}' must be recurring for subscriptions`);
	}
	if (price.unit_amount == null) {
		throw new Error(
			`Stripe price '${priceId}' has no unit_amount. Configure a fixed recurring unit amount.`,
		);
	}

	const expectedCents = Math.round(PRO_MONTHLY_PRICE_USD * 100);
	if (price.unit_amount !== expectedCents) {
		throw new Error(
			`Stripe price mismatch: expected ${expectedCents} cents, got ${price.unit_amount} cents for '${priceId}'`,
		);
	}

	validatedPriceId = priceId;
}

/**
 * Upsert durable user<->Stripe customer mapping.
 */
async function upsertBillingCustomer(
	ctx: any,
	args: { userId: string; stripeCustomerId: string; email?: string },
): Promise<void> {
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
 * Resolve customer id using local mapping first, then Stripe lookup/create.
 */
async function findOrCreateStripeCustomer(
	ctx: any,
	args: { userId: string; userEmail?: string },
): Promise<string> {
	const mappedCustomer = await ctx.db
		.query('billing_customers')
		.withIndex('userId', (q: any) => q.eq('userId', args.userId))
		.first();

	if (mappedCustomer?.stripeCustomerId) {
		return mappedCustomer.stripeCustomerId;
	}

	let customerId: string;

	if (args.userEmail) {
		const existingByEmail = await stripe.customers.list({
			email: args.userEmail,
			limit: 1,
		});
		if (existingByEmail.data[0]) {
			const customer = existingByEmail.data[0];
			customerId = customer.id;
			if (customer.metadata?.clerkUserId !== args.userId) {
				await stripe.customers.update(customer.id, {
					metadata: {
						...customer.metadata,
						clerkUserId: args.userId,
					},
				});
			}
		} else {
			const created = await stripe.customers.create({
				email: args.userEmail,
				metadata: { clerkUserId: args.userId },
			});
			customerId = created.id;
		}
	} else {
		const created = await stripe.customers.create({
			metadata: { clerkUserId: args.userId },
		});
		customerId = created.id;
	}

	await upsertBillingCustomer(ctx, {
		userId: args.userId,
		stripeCustomerId: customerId,
		email: args.userEmail,
	});

	return customerId;
}

/**
 * Create a Stripe Checkout session for subscription.
 */
export const createCheckoutSession = mutation({
	args: {
		userEmail: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const existingSubscription = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.first();

		if (
			existingSubscription &&
			isOpenBillingSubscriptionStatus(existingSubscription.status)
		) {
			throw new Error('User already has an existing subscription');
		}

		const customerId = await findOrCreateStripeCustomer(ctx, {
			userId,
			userEmail: args.userEmail,
		});
		await assertStripeSubscriptionPriceMatchesCatalog();

		const session = await stripe.checkout.sessions.create({
			customer: customerId,
			line_items: [{ price: getStripePriceId() }],
			mode: 'subscription',
			success_url: `${getServerUrl()}/pricing?success=true`,
			cancel_url: `${getServerUrl()}/pricing?canceled=true`,
			metadata: {
				clerkUserId: userId,
			},
		});

		return {
			sessionId: session.id,
			url: session.url,
		};
	},
});

/**
 * Create a Stripe Billing Portal session for self-serve billing management.
 */
export const createBillingPortalSession = mutation({
	args: {},
	handler: async (ctx) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const mappedCustomer = await ctx.db
			.query('billing_customers')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.first();

		if (!mappedCustomer?.stripeCustomerId) {
			throw new Error('No billing customer found for user');
		}

		const portalSession = await stripe.billingPortal.sessions.create({
			customer: mappedCustomer.stripeCustomerId,
			return_url: `${getServerUrl()}/pricing`,
		});

		return { url: portalSession.url };
	},
});

/**
 * Set subscription cancellation at period end.
 */
export const cancelSubscriptionAtPeriodEnd = mutation({
	args: {},
	handler: async (ctx) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const subscription = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.first();

		if (!subscription) {
			throw new Error('Subscription not found');
		}

		await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
			cancel_at_period_end: true,
		});

		await ctx.db.patch(subscription._id, {
			cancelAtPeriodEnd: true,
		});

		return { success: true };
	},
});

/**
 * Resume a subscription previously set to cancel at period end.
 */
export const resumeSubscription = mutation({
	args: {},
	handler: async (ctx) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const subscription = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.first();

		if (!subscription) {
			throw new Error('Subscription not found');
		}

		await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
			cancel_at_period_end: false,
		});

		await ctx.db.patch(subscription._id, {
			cancelAtPeriodEnd: false,
			status: 'active',
		});

		return { success: true };
	},
});

/**
 * Set or clear monthly spend cap for paid users.
 */
export const setMonthlySpendCap = mutation({
	args: {
		monthlySpendCap: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const subscription = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.first();

		if (!subscription) {
			throw new Error('Subscription not found');
		}

		if (args.monthlySpendCap !== undefined && args.monthlySpendCap < 0) {
			throw new Error('monthlySpendCap must be non-negative');
		}

		await ctx.db.patch(subscription._id, {
			monthlySpendCap: args.monthlySpendCap,
		});

		return { success: true, monthlySpendCap: args.monthlySpendCap };
	},
});

/**
 * Billing settings for in-product controls.
 */
export const getBillingSettings = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const subscription = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.first();

		if (!subscription) {
			return null;
		}

		return {
			status: subscription.status,
			monthlySpendCap:
				subscription.monthlySpendCap ?? DEFAULT_INCLUDED_TOKEN_CREDIT_USD,
			cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
			lastInvoicePaymentStatus: subscription.lastInvoicePaymentStatus,
		};
	},
});
