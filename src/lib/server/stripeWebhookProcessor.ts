import type { ConvexHttpClient } from "convex/browser";
import type Stripe from "stripe";
import { api } from "../../../convex/_generated/api";
import { DEFAULT_INCLUDED_TOKEN_CREDIT_USD } from "../../../convex/pricing";

function toMillis(unixSeconds: number | null | undefined): number {
	if (!unixSeconds) return Date.now();
	return unixSeconds * 1000;
}

function getSubscriptionPeriod(
	subscription: Stripe.Subscription | Stripe.Response<Stripe.Subscription>,
) {
	const raw = subscription as unknown as {
		current_period_start?: number;
		current_period_end?: number;
	};

	return {
		currentPeriodStart: toMillis(raw.current_period_start),
		currentPeriodEnd: toMillis(raw.current_period_end),
	};
}

function getStripeSubscriptionId(
	value: string | Stripe.Subscription | null,
): string | undefined {
	if (!value) return undefined;
	if (typeof value === "string") return value;
	return value.id;
}

function getStripeCustomerId(
	value: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | undefined {
	if (!value) return undefined;
	if (typeof value === "string") return value;
	return value.id;
}

async function resolveUserId(
	convexClient: ConvexHttpClient,
	stripeCustomerId: string,
	subscriptionMetadataUserId?: string,
): Promise<string | null> {
	if (subscriptionMetadataUserId) return subscriptionMetadataUserId;
	return await convexClient.query(
		api.stripeWebhooks.getUserIdByStripeCustomerId,
		{
			stripeCustomerId,
		},
	);
}

async function processStripeEvent(
	convexClient: ConvexHttpClient,
	stripe: Stripe,
	event: Stripe.Event,
): Promise<void> {
	if (event.type === "checkout.session.completed") {
		const session = event.data.object as Stripe.Checkout.Session;
		const userId = session.metadata?.clerkUserId;
		const stripeSubscriptionId =
			typeof session.subscription === "string"
				? session.subscription
				: session.subscription?.id;
		if (userId && stripeSubscriptionId) {
			const subscription = await stripe.subscriptions.retrieve(
				String(stripeSubscriptionId),
			);
			const { currentPeriodStart, currentPeriodEnd } =
				getSubscriptionPeriod(subscription);
			await convexClient.mutation(
				api.stripeWebhooks.upsertSubscriptionFromStripe,
				{
					userId,
					stripeCustomerId: String(subscription.customer),
					stripeSubscriptionId: subscription.id,
					status: subscription.status,
					currentPeriodStart,
					currentPeriodEnd,
					includedTokenCredit: DEFAULT_INCLUDED_TOKEN_CREDIT_USD,
					cancelAtPeriodEnd: subscription.cancel_at_period_end,
				},
			);
		}
		return;
	}

	if (
		event.type === "customer.subscription.created" ||
		event.type === "customer.subscription.updated" ||
		event.type === "customer.subscription.deleted"
	) {
		const subscription = event.data.object as Stripe.Subscription;
		const stripeCustomerId = String(subscription.customer);
		const userId = await resolveUserId(
			convexClient,
			stripeCustomerId,
			subscription.metadata?.clerkUserId,
		);
		if (userId) {
			const { currentPeriodStart, currentPeriodEnd } =
				getSubscriptionPeriod(subscription);
			await convexClient.mutation(
				api.stripeWebhooks.upsertSubscriptionFromStripe,
				{
					userId,
					stripeCustomerId,
					stripeSubscriptionId: subscription.id,
					status: subscription.status,
					currentPeriodStart,
					currentPeriodEnd,
					includedTokenCredit: DEFAULT_INCLUDED_TOKEN_CREDIT_USD,
					cancelAtPeriodEnd: subscription.cancel_at_period_end,
				},
			);
		}
		return;
	}

	if (
		event.type === "invoice.paid" ||
		event.type === "invoice.payment_failed"
	) {
		const invoice = event.data.object as Stripe.Invoice;
		const rawInvoice = invoice as unknown as {
			subscription?: string | Stripe.Subscription | null;
			customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
		};
		const stripeSubscriptionId = getStripeSubscriptionId(
			rawInvoice.subscription ?? null,
		);
		const stripeCustomerId = getStripeCustomerId(rawInvoice.customer ?? null);
		await convexClient.mutation(
			api.stripeWebhooks.updateSubscriptionByStripeIds,
			{
				stripeSubscriptionId,
				stripeCustomerId,
				status: event.type === "invoice.paid" ? "active" : "past_due",
				lastInvoicePaymentStatus:
					event.type === "invoice.paid" ? "paid" : "failed",
			},
		);
		if (event.type === "invoice.payment_failed") {
			await convexClient.mutation(api.stripeWebhooks.logBillingAlert, {
				source: "invoice",
				severity: "warning",
				message: "Invoice payment failed",
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

	if (event.type === "invoice.finalized") {
		const invoice = event.data.object as Stripe.Invoice;
		const rawInvoice = invoice as unknown as {
			subscription?: string | Stripe.Subscription | null;
			customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
		};
		const stripeSubscriptionId = getStripeSubscriptionId(
			rawInvoice.subscription ?? null,
		);
		const stripeCustomerId = getStripeCustomerId(rawInvoice.customer ?? null);
		await convexClient.mutation(
			api.stripeWebhooks.updateSubscriptionByStripeIds,
			{
				stripeSubscriptionId,
				stripeCustomerId,
				lastInvoicePaymentStatus: "open",
			},
		);
		return;
	}

	if (event.type === "customer.subscription.trial_will_end") {
		const subscription = event.data.object as Stripe.Subscription;
		await convexClient.mutation(
			api.stripeWebhooks.updateSubscriptionByStripeIds,
			{
				stripeSubscriptionId: subscription.id,
				stripeCustomerId: String(subscription.customer),
				status: "trialing",
			},
		);
		await convexClient.mutation(api.stripeWebhooks.logBillingAlert, {
			source: "invoice",
			severity: "info",
			message: "Subscription trial will end soon",
			context: JSON.stringify({
				eventId: event.id,
				stripeSubscriptionId: subscription.id,
				stripeCustomerId: String(subscription.customer),
			}),
		});
	}
}

export async function handleStripeEvent(params: {
	convexClient: ConvexHttpClient;
	stripe: Stripe;
	event: Stripe.Event;
	payload?: string;
}) {
	const { convexClient, stripe, event, payload } = params;

	const state = await convexClient.mutation(
		api.stripeWebhooks.beginWebhookEventProcessing,
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
		await processStripeEvent(convexClient, stripe, event);
		await convexClient.mutation(api.stripeWebhooks.markWebhookEventProcessed, {
			eventId: event.id,
		});
		return { duplicate: false as const };
	} catch (error) {
		await convexClient.mutation(api.stripeWebhooks.markWebhookEventFailed, {
			eventId: event.id,
			type: event.type,
			error: error instanceof Error ? error.message : String(error),
			payload,
		});
		throw error;
	}
}
