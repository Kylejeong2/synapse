import Stripe from "stripe";
import dotenv from "dotenv";
import { lookup } from "node:dns/promises";
import { describe, expect, it } from "vitest";

dotenv.config({ path: ".env.local" });

const runLive = process.env.RUN_STRIPE_LIVE_TESTS === "1";
const describeLive = runLive ? describe : describe.skip;

describeLive("Stripe live integration (test mode)", () => {
	it(
		"creates a real subscription checkout session in Stripe test mode",
		async () => {
			const secretKey = process.env.STRIPE_SECRET_KEY;
			const priceId =
				process.env.STRIPE_LIVE_TEST_PRICE_ID ||
				process.env.STRIPE_PRICE_ID_SUBSCRIPTION;

			if (!secretKey) {
				throw new Error("STRIPE_SECRET_KEY is required for live Stripe tests");
			}
			if (!secretKey.startsWith("sk_test_")) {
				throw new Error(
					"Refusing to run live Stripe tests with a non-test key (must start with sk_test_)",
				);
			}
			if (!priceId) {
				throw new Error(
					"Set STRIPE_LIVE_TEST_PRICE_ID (or STRIPE_PRICE_ID_SUBSCRIPTION) for live Stripe tests",
				);
			}
			try {
				await lookup("api.stripe.com");
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				throw new Error(
					`Cannot resolve api.stripe.com (${message}). Check DNS/internet access before running live Stripe tests.`,
				);
			}

			const stripe = new Stripe(secretKey, {
				apiVersion: "2025-12-15.clover",
				typescript: true,
			});
			let verifiedPrice;
			try {
				verifiedPrice = await stripe.prices.retrieve(priceId);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				throw new Error(
					`Failed to retrieve Stripe price '${priceId}'. Ensure the price exists in TEST mode and your test key has access. Original error: ${message}`,
				);
			}
			if (!verifiedPrice.active) {
				throw new Error(`Stripe price '${priceId}' is not active.`);
			}
			if (!verifiedPrice.recurring) {
				throw new Error(
					`Stripe price '${priceId}' is not recurring. Subscription checkout requires a recurring price.`,
				);
			}

			const customer = await stripe.customers.create({
				email: `stripe-live-test-${Date.now()}@example.com`,
				metadata: {
					clerkUserId: `live_test_user_${Date.now()}`,
				},
			});

			try {
				let session;
				try {
					session = await stripe.checkout.sessions.create({
						customer: customer.id,
						mode: "subscription",
						line_items: [{ price: priceId }],
						success_url: "https://example.com/pricing?success=true",
						cancel_url: "https://example.com/pricing?canceled=true",
						metadata: {
							clerkUserId: "live_test_user",
						},
					});
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					throw new Error(`Checkout session creation failed: ${message}`);
				}

				expect(session.id).toMatch(/^cs_/);
				expect(session.mode).toBe("subscription");
				expect(session.url).toBeTruthy();
			} finally {
				// Best-effort cleanup; customer deletion may fail if Stripe attaches objects.
				try {
					await stripe.customers.del(customer.id);
				} catch {
					// no-op
				}
			}
		},
		60_000,
	);
});
