import Stripe from "stripe";

export const STRIPE_API_VERSION: Stripe.LatestApiVersion = "2025-12-15.clover";

export function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} environment variable is not set`);
	}
	return value;
}

export function createStripeClient(): Stripe {
	return new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"), {
		apiVersion: STRIPE_API_VERSION,
		typescript: true,
	});
}
