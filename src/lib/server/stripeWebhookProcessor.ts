import type { ConvexHttpClient } from "convex/browser";
import type Stripe from "stripe";
import { api } from "../../../convex/_generated/api";

function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} environment variable is not set`);
	}
	return value;
}

export async function handleStripeEvent(params: {
	convexClient: ConvexHttpClient;
	stripe: Stripe;
	event: Stripe.Event;
	payload?: string;
}) {
	const { convexClient, event, payload } = params;

	const result = await convexClient.mutation(
		api.stripeWebhooks.processWebhookEvent,
		{
			event,
			payload,
			token: getRequiredEnv("STRIPE_WEBHOOK_CONVEX_TOKEN"),
		},
	);

	return {
		duplicate: Boolean(result.duplicate),
	} as const;
}
