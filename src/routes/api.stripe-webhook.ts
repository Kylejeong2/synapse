import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import Stripe from "stripe";
import { env } from "@/env";
import { api } from "../../convex/_generated/api";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "";
if (!CONVEX_URL) {
	throw new Error("VITE_CONVEX_URL environment variable is not set");
}
const convexClient = new ConvexHttpClient(CONVEX_URL);

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
	apiVersion: "2025-12-15.clover",
});

export const Route = createFileRoute("/api/stripe-webhook")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const body = await request.text();
				const signature = request.headers.get("stripe-signature");

				if (!signature) {
					return new Response(
						JSON.stringify({ error: "Missing stripe-signature header" }),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				let event: Stripe.Event;
				try {
					event = stripe.webhooks.constructEvent(
						body,
						signature,
						env.STRIPE_WEBHOOK_SECRET,
					);
				} catch (err) {
					console.error("Webhook signature verification failed:", err);
					return new Response(
						JSON.stringify({
							error: `Webhook signature verification failed: ${err}`,
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				// Route to appropriate handler
				try {
					switch (event.type) {
						case "customer.subscription.created":
							await convexClient.mutation(
								api.stripeWebhooks.handleSubscriptionCreated,
								{
									subscription: event.data.object as Stripe.Subscription,
								},
							);
							break;
						case "customer.subscription.updated":
							await convexClient.mutation(
								api.stripeWebhooks.handleSubscriptionUpdated,
								{
									subscription: event.data.object as Stripe.Subscription,
								},
							);
							break;
						case "customer.subscription.deleted":
							await convexClient.mutation(
								api.stripeWebhooks.handleSubscriptionDeleted,
								{
									subscription: event.data.object as Stripe.Subscription,
								},
							);
							break;
						case "invoice.payment_succeeded":
							await convexClient.mutation(
								api.stripeWebhooks.handleInvoicePaymentSucceeded,
								{
									invoice: event.data.object as Stripe.Invoice,
								},
							);
							break;
						case "invoice.payment_failed":
							await convexClient.mutation(
								api.stripeWebhooks.handleInvoicePaymentFailed,
								{
									invoice: event.data.object as Stripe.Invoice,
								},
							);
							break;
						default:
							console.log(`Unhandled event type: ${event.type}`);
					}

					return new Response(JSON.stringify({ received: true }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				} catch (error) {
					console.error("Error processing webhook:", error);
					return new Response(
						JSON.stringify({
							error: "Error processing webhook",
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
