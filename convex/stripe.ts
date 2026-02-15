/**
 * Stripe client initialization for Convex
 * Uses environment variables for configuration
 * Lazy initialization 
 */

import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
	if (!stripeInstance) {
		const secretKey = process.env.STRIPE_SECRET_KEY;
		if (!secretKey) {
			throw new Error('STRIPE_SECRET_KEY environment variable is not set');
		}
		stripeInstance = new Stripe(secretKey, {
			apiVersion: '2025-12-15.clover',
			typescript: true,
		});
	}
	return stripeInstance;
}

export const stripe = new Proxy({} as Stripe, {
	get(_target, prop) {
		return getStripe()[prop as keyof Stripe];
	},
});

// Export Stripe environment variables for use in other functions
// Access lazily to avoid errors during module analysis
function getEnvVar(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} environment variable is not set`);
	}
	return value;
}

export function getStripePriceId(): string {
	return getEnvVar('STRIPE_PRICE_ID_SUBSCRIPTION');
}
