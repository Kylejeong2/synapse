import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { getRequiredEnv } from "./stripeServer";

export async function handleStripeEvent(params: {
	convexClient: ConvexHttpClient;
	event: { id: string; type: string; created: number };
	payload?: string;
}) {
	const { convexClient, event, payload } = params;

	const result = await convexClient.action(
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
