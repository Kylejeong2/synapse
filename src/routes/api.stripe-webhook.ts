import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import Stripe from "stripe";
import { api } from "../../convex/_generated/api";
import { DEFAULT_INCLUDED_TOKEN_CREDIT_USD } from "../../convex/pricing";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "";
if (!CONVEX_URL) {
	throw new Error("VITE_CONVEX_URL environment variable is not set");
}

const convexClient = new ConvexHttpClient(CONVEX_URL);

const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2025-12-15.clover";

function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} environment variable is not set`);
	}
	return value;
}

function createStripeClient(): Stripe {
	return new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"), {
		apiVersion: STRIPE_API_VERSION,
		typescript: true,
	});
}

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

export const Route = createFileRoute("/api/stripe-webhook")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const signature = request.headers.get("stripe-signature");
					if (!signature) {
						return new Response(
							JSON.stringify({ error: "Missing Stripe signature" }),
							{
								status: 400,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					const payload = await request.text();
					const stripe = createStripeClient();
					const webhookSecret = getRequiredEnv("STRIPE_WEBHOOK_SECRET");

					let event: Stripe.Event;
					try {
						event = stripe.webhooks.constructEvent(
							payload,
							signature,
							webhookSecret,
						);
					} catch (error) {
						return new Response(
							JSON.stringify({
								error: "Invalid Stripe webhook signature",
								details: error instanceof Error ? error.message : String(error),
							}),
							{
								status: 400,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					const registered = await convexClient.mutation(
						api.stripeWebhooks.registerWebhookEvent,
						{
							eventId: event.id,
							type: event.type,
							createdAt: event.created * 1000,
						},
					);

					if (!registered.accepted) {
						return new Response(
							JSON.stringify({ received: true, duplicate: true }),
							{
								status: 200,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					if (
						event.type === "customer.subscription.created" ||
						event.type === "customer.subscription.updated" ||
						event.type === "customer.subscription.deleted"
					) {
						const subscription = event.data.object as Stripe.Subscription;
						const userId = subscription.metadata?.clerkUserId;
						if (userId) {
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
								},
							);
						}
					}

					if (event.type === "checkout.session.completed") {
						const session = event.data.object as Stripe.Checkout.Session;
						const userId = session.metadata?.clerkUserId;
						if (userId && session.subscription) {
							const subscription = await stripe.subscriptions.retrieve(
								String(session.subscription),
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
								},
							);
						}
					}

					return new Response(JSON.stringify({ received: true }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				} catch (error) {
					console.error("Stripe webhook processing failed:", error);
					return new Response(
						JSON.stringify({
							error: "Stripe webhook processing failed",
							details: error instanceof Error ? error.message : String(error),
						}),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			},
		},
	},
});
