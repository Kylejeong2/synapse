import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import Stripe from "stripe";
import { handleStripeEvent } from "@/lib/server/stripeWebhookProcessor";

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

function tokenMatches(actual: string | null, expected: string): boolean {
	if (!actual) return false;
	const actualBuffer = Buffer.from(actual);
	const expectedBuffer = Buffer.from(expected);
	if (actualBuffer.length !== expectedBuffer.length) return false;
	return timingSafeEqual(actualBuffer, expectedBuffer);
}

function getForwardedIp(request: Request): string | null {
	const forwarded = request.headers.get("x-forwarded-for");
	if (!forwarded) return null;
	const first = forwarded.split(",")[0]?.trim();
	return first || null;
}

function isReplayIpAllowed(request: Request): boolean {
	const configured = process.env.STRIPE_WEBHOOK_REPLAY_ALLOWED_IPS;
	if (!configured) return true;
	const allowedIps = configured
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	if (allowedIps.length === 0) return true;
	const sourceIp = getForwardedIp(request);
	if (!sourceIp) return false;
	return allowedIps.includes(sourceIp);
}

export const Route = createFileRoute("/api/stripe-webhook/replay")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const token = request.headers.get("x-webhook-replay-token");
					const expected = getRequiredEnv("STRIPE_WEBHOOK_REPLAY_TOKEN");
					if (!tokenMatches(token, expected)) {
						return new Response(JSON.stringify({ error: "Unauthorized" }), {
							status: 401,
							headers: { "Content-Type": "application/json" },
						});
					}
					if (!isReplayIpAllowed(request)) {
						return new Response(JSON.stringify({ error: "Forbidden" }), {
							status: 403,
							headers: { "Content-Type": "application/json" },
						});
					}

					const body = await request.json();
					const eventId = body?.eventId as string | undefined;
					if (!eventId) {
						return new Response(
							JSON.stringify({ error: "eventId is required" }),
							{
								status: 400,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					const stripe = createStripeClient();
					const event = await stripe.events.retrieve(eventId);
					const result = await handleStripeEvent({
						convexClient,
						stripe,
						event,
						payload: JSON.stringify(event),
					});

					return new Response(
						JSON.stringify({
							replayed: true,
							duplicate: result.duplicate,
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				} catch (error) {
					return new Response(
						JSON.stringify({
							error: "Replay failed",
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
