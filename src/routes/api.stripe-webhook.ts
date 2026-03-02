import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { createStripeClient, getRequiredEnv } from "@/lib/server/stripeServer";
import { handleStripeEvent } from "@/lib/server/stripeWebhookProcessor";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "";
if (!CONVEX_URL) {
	throw new Error("VITE_CONVEX_URL environment variable is not set");
}

const convexClient = new ConvexHttpClient(CONVEX_URL);

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

					let event: Parameters<typeof handleStripeEvent>[0]["event"];
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

					const result = await handleStripeEvent({
						convexClient,
						event,
						payload,
					});

					if (result.duplicate) {
						return new Response(
							JSON.stringify({ received: true, duplicate: true }),
							{
								status: 200,
								headers: { "Content-Type": "application/json" },
							},
						);
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
