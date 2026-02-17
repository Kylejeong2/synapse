import { internal } from './_generated/api';
import {
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
} from './_generated/server';
import { v } from 'convex/values';
import { DEFAULT_INCLUDED_TOKEN_CREDIT_USD } from './pricing';
import { stripe } from './stripe';

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

function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} environment variable is not set`);
	}
	return value;
}

function assertWebhookProcessingToken(token: string) {
	const expected = getRequiredEnv('STRIPE_WEBHOOK_CONVEX_TOKEN');
	if (token !== expected) {
		throw new Error('Unauthorized');
	}
}

function toMillis(unixSeconds: number | null | undefined): number {
	if (!unixSeconds) return Date.now();
	return unixSeconds * 1000;
}

function getStripeSubscriptionId(value: unknown): string | undefined {
	if (!value) return undefined;
	return typeof value === 'string' ? value : (value as { id: string }).id;
}

function getStripeCustomerId(value: unknown): string | undefined {
	if (!value) return undefined;
	return typeof value === 'string' ? value : (value as { id: string }).id;
}

async function processStripeEventInConvex(ctx: any, event: any) {
	if (event.type === 'checkout.session.completed') {
		const session = event.data.object;
		const userId = session.metadata?.clerkUserId;
		const stripeSubscriptionId = getStripeSubscriptionId(session.subscription);
		if (userId && stripeSubscriptionId) {
			const subscription = await stripe.subscriptions.retrieve(
				String(stripeSubscriptionId),
			);
			const rawSubscription = subscription as unknown as {
				current_period_start?: number;
				current_period_end?: number;
			};
			await ctx.runMutation(internal.stripeWebhooks.upsertSubscriptionFromStripe, {
				userId,
				stripeCustomerId: String(subscription.customer),
				stripeSubscriptionId: subscription.id,
				status: subscription.status,
				currentPeriodStart: toMillis(rawSubscription.current_period_start),
				currentPeriodEnd: toMillis(rawSubscription.current_period_end),
				includedTokenCredit: DEFAULT_INCLUDED_TOKEN_CREDIT_USD,
				cancelAtPeriodEnd: subscription.cancel_at_period_end,
			});
		}
		return;
	}

	if (
		event.type === 'customer.subscription.created' ||
		event.type === 'customer.subscription.updated' ||
		event.type === 'customer.subscription.deleted'
	) {
		const subscription = event.data.object;
		const stripeCustomerId = String(subscription.customer);
		const userId =
			subscription.metadata?.clerkUserId ||
			(await ctx.runQuery(internal.stripeWebhooks.getUserIdByStripeCustomerId, {
				stripeCustomerId,
			}));
		if (userId) {
			await ctx.runMutation(internal.stripeWebhooks.upsertSubscriptionFromStripe, {
				userId,
				stripeCustomerId,
				stripeSubscriptionId: subscription.id,
				status: subscription.status,
				currentPeriodStart: toMillis(subscription.current_period_start),
				currentPeriodEnd: toMillis(subscription.current_period_end),
				includedTokenCredit: DEFAULT_INCLUDED_TOKEN_CREDIT_USD,
				cancelAtPeriodEnd: subscription.cancel_at_period_end,
			});
		}
		return;
	}

	if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
		const invoice = event.data.object;
		const stripeSubscriptionId = getStripeSubscriptionId(invoice.subscription);
		const stripeCustomerId = getStripeCustomerId(invoice.customer);
		await ctx.runMutation(internal.stripeWebhooks.updateSubscriptionByStripeIds, {
			stripeSubscriptionId,
			stripeCustomerId,
			status: event.type === 'invoice.paid' ? 'active' : 'past_due',
			lastInvoicePaymentStatus:
				event.type === 'invoice.paid' ? 'paid' : 'failed',
		});
		if (event.type === 'invoice.payment_failed') {
			await ctx.runMutation(internal.stripeWebhooks.logBillingAlert, {
				source: 'invoice',
				severity: 'warning',
				message: 'Invoice payment failed',
				context: JSON.stringify({
					eventId: event.id,
					stripeSubscriptionId,
					stripeCustomerId,
					invoiceId: invoice.id,
				}),
			});
		}
		return;
	}

	if (event.type === 'invoice.finalized') {
		const invoice = event.data.object;
		await ctx.runMutation(internal.stripeWebhooks.updateSubscriptionByStripeIds, {
			stripeSubscriptionId: getStripeSubscriptionId(invoice.subscription),
			stripeCustomerId: getStripeCustomerId(invoice.customer),
			lastInvoicePaymentStatus: 'open',
		});
		return;
	}

	if (event.type === 'customer.subscription.trial_will_end') {
		const subscription = event.data.object;
		await ctx.runMutation(internal.stripeWebhooks.updateSubscriptionByStripeIds, {
			stripeSubscriptionId: subscription.id,
			stripeCustomerId: String(subscription.customer),
			status: 'trialing',
		});
		await ctx.runMutation(internal.stripeWebhooks.logBillingAlert, {
			source: 'invoice',
			severity: 'info',
			message: 'Subscription trial will end soon',
			context: JSON.stringify({
				eventId: event.id,
				stripeSubscriptionId: subscription.id,
				stripeCustomerId: String(subscription.customer),
			}),
		});
		return;
	}

	if (event.type === 'charge.refunded') {
		const charge = event.data.object;
		await ctx.runMutation(internal.stripeWebhooks.logBillingAlert, {
			source: 'invoice',
			severity: 'warning',
			message: 'Charge refunded',
			context: JSON.stringify({
				eventId: event.id,
				chargeId: charge.id,
				amountRefunded: charge.amount_refunded,
				currency: charge.currency,
				customer: getStripeCustomerId(charge.customer),
			}),
		});
		return;
	}

	if (event.type === 'charge.dispute.created') {
		const dispute = event.data.object;
		await ctx.runMutation(internal.stripeWebhooks.logBillingAlert, {
			source: 'invoice',
			severity: 'error',
			message: 'Charge dispute created',
			context: JSON.stringify({
				eventId: event.id,
				disputeId: dispute.id,
				chargeId: dispute.charge,
				amount: dispute.amount,
				currency: dispute.currency,
				reason: dispute.reason,
			}),
		});
		return;
	}

	if (event.type === 'credit_note.created' || event.type === 'credit_note.updated') {
		const creditNote = event.data.object;
		await ctx.runMutation(internal.stripeWebhooks.logBillingAlert, {
			source: 'invoice',
			severity: 'warning',
			message: `Credit note ${event.type === 'credit_note.created' ? 'created' : 'updated'}`,
			context: JSON.stringify({
				eventId: event.id,
				creditNoteId: creditNote.id,
				invoiceId: creditNote.invoice,
				amount: creditNote.amount,
				currency: creditNote.currency,
			}),
		});
	}
}

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
 * Public webhook entrypoint. Signature verification must happen before invoking.
 */
export const processWebhookEvent = mutation({
	args: {
		event: v.any(),
		payload: v.optional(v.string()),
		token: v.string(),
	},
	handler: async (ctx, args) => {
		assertWebhookProcessingToken(args.token);
		const event = args.event as {
			id: string;
			type: string;
			created: number;
		};

		const state = await ctx.runMutation(
			internal.stripeWebhooks.beginWebhookEventProcessing,
			{
				eventId: event.id,
				type: event.type,
				createdAt: event.created * 1000,
			},
		);

		if (!state.proceed) {
			return { duplicate: true as const };
		}

		try {
			await processStripeEventInConvex(ctx, args.event);
			await ctx.runMutation(internal.stripeWebhooks.markWebhookEventProcessed, {
				eventId: event.id,
			});
			return { duplicate: false as const };
		} catch (error) {
			await ctx.runMutation(internal.stripeWebhooks.markWebhookEventFailed, {
				eventId: event.id,
				type: event.type,
				error: error instanceof Error ? error.message : String(error),
				payload: args.payload,
			});
			throw error;
		}
	},
});

/**
 * Enter webhook event processing state. Allows retries for failed events.
 */
export const beginWebhookEventProcessing = internalMutation({
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

export const markWebhookEventProcessed = internalMutation({
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

export const markWebhookEventFailed = internalMutation({
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
			notificationAttempts: 0,
		});

		return { success: true };
	},
});

/**
 * Upsert durable user <-> Stripe customer mapping.
 */
export const upsertBillingCustomerMapping = internalMutation({
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
export const upsertSubscriptionFromStripe = internalMutation({
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
export const updateSubscriptionByStripeIds = internalMutation({
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

export const listFailedWebhookEvents = internalQuery({
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

export const getUserIdByStripeCustomerId = internalQuery({
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

export const logBillingAlert = internalMutation({
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
			notificationAttempts: 0,
		});
	},
});

/**
 * Auto-retry unresolved Stripe webhook failures using canonical Stripe event data.
 */
export const retryFailedWebhookEvents = internalAction({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (
		ctx,
		args,
	): Promise<{ scanned: number; retried: number; processed: number; errors: number }> => {
		const failures: Array<{ eventId: string; type: string }> = await ctx.runQuery(
			internal.stripeWebhooks.listFailedWebhookEvents,
			{
				limit: args.limit ?? 25,
			},
		);

		let retried = 0;
		let processed = 0;
		let errors = 0;

		for (const failure of failures) {
			retried++;
			try {
				const event = await stripe.events.retrieve(failure.eventId);
				const state = await ctx.runMutation(
					internal.stripeWebhooks.beginWebhookEventProcessing,
					{
						eventId: event.id,
						type: event.type,
						createdAt: event.created * 1000,
					},
				);
				if (!state.proceed) continue;

				await processStripeEventInConvex(ctx, event);
				await ctx.runMutation(internal.stripeWebhooks.markWebhookEventProcessed, {
					eventId: event.id,
				});
				processed++;
			} catch (error) {
				errors++;
				await ctx.runMutation(internal.stripeWebhooks.markWebhookEventFailed, {
					eventId: failure.eventId,
					type: failure.type,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return { scanned: failures.length, retried, processed, errors };
	},
});
