import { action, mutation, query, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { DEFAULT_INCLUDED_TOKEN_CREDIT_USD, PRO_MONTHLY_PRICE_USD } from './pricing';
import { stripe, getStripePriceId } from './stripe';
import { isOpenBillingSubscriptionStatus } from './subscriptionStatus';
import { requireAuthenticatedUserId } from './auth';
import { upsertBillingCustomerByUserId } from './billingCustomers';

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

// --- Internal DB helpers (usable from actions) ---

export const getSubscriptionByUserId = internalQuery({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.first();
	},
});

export const getBillingCustomerByUserId = internalQuery({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query('billing_customers')
			.withIndex('userId', (q) => q.eq('userId', args.userId))
			.first();
	},
});

export const upsertBillingCustomerInternal = internalMutation({
	args: {
		userId: v.string(),
		stripeCustomerId: v.string(),
		email: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await upsertBillingCustomerByUserId(ctx, args);
	},
});

// --- Actions (Node.js runtime, can call Stripe APIs) ---

/**
 * Resolve customer id using local mapping first, then Stripe lookup/create.
 */
async function findOrCreateStripeCustomerViaAction(
	ctx: any,
	args: { userId: string; userEmail?: string },
): Promise<string> {
	const mappedCustomer = await ctx.runQuery(
		internal.subscriptions.getBillingCustomerByUserId,
		{ userId: args.userId },
	);

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

	await ctx.runMutation(internal.subscriptions.upsertBillingCustomerInternal, {
		userId: args.userId,
		stripeCustomerId: customerId,
		email: args.userEmail,
	});

	return customerId;
}

/**
 * Create a Stripe Checkout session for subscription.
 */
export const createCheckoutSession = action({
	args: {
		userEmail: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		const userId = identity?.subject;
		if (!userId) {
			throw new Error('Unauthorized');
		}

		const existingSubscription = await ctx.runQuery(
			internal.subscriptions.getSubscriptionByUserId,
			{ userId },
		);

		if (
			existingSubscription &&
			isOpenBillingSubscriptionStatus(existingSubscription.status)
		) {
			throw new Error('User already has an existing subscription');
		}

		const customerId = await findOrCreateStripeCustomerViaAction(ctx, {
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
export const createBillingPortalSession = action({
	args: {},
	handler: async (ctx): Promise<{ url: string }> => {
		const identity = await ctx.auth.getUserIdentity();
		const userId = identity?.subject;
		if (!userId) {
			throw new Error('Unauthorized');
		}

		const mappedCustomer: { stripeCustomerId?: string } | null = await ctx.runQuery(
			internal.subscriptions.getBillingCustomerByUserId,
			{ userId },
		);

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
export const cancelSubscriptionAtPeriodEnd = action({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		const userId = identity?.subject;
		if (!userId) {
			throw new Error('Unauthorized');
		}

		const subscription = await ctx.runQuery(
			internal.subscriptions.getSubscriptionByUserId,
			{ userId },
		);

		if (!subscription) {
			throw new Error('Subscription not found');
		}

		const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
			cancel_at_period_end: true,
		});

		// Stripe is the source of truth; webhook updates local subscription state.
		return {
			success: true,
			cancelAtPeriodEnd: updated.cancel_at_period_end,
			pendingWebhookSync: true,
		};
	},
});

/**
 * Resume a subscription previously set to cancel at period end.
 */
export const resumeSubscription = action({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		const userId = identity?.subject;
		if (!userId) {
			throw new Error('Unauthorized');
		}

		const subscription = await ctx.runQuery(
			internal.subscriptions.getSubscriptionByUserId,
			{ userId },
		);

		if (!subscription) {
			throw new Error('Subscription not found');
		}

		const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
			cancel_at_period_end: false,
		});

		// Stripe is the source of truth; webhook updates local subscription state.
		return {
			success: true,
			cancelAtPeriodEnd: updated.cancel_at_period_end,
			pendingWebhookSync: true,
		};
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
