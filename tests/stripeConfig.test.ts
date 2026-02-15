import { afterEach, describe, expect, it, vi } from "vitest";

const stripeCtorMock = vi.fn(() => ({
	customers: { list: vi.fn() },
	checkout: { sessions: { create: vi.fn() } },
}));

vi.mock("stripe", () => ({
	default: stripeCtorMock,
}));

const originalEnv = { ...process.env };

describe("convex/stripe configuration", () => {
	afterEach(() => {
		vi.resetModules();
		stripeCtorMock.mockClear();
		process.env = { ...originalEnv };
	});

	it("throws when STRIPE_SECRET_KEY is missing and client is accessed", async () => {
		delete process.env.STRIPE_SECRET_KEY;
		const { stripe } = await import("../convex/stripe");

		expect(() => (stripe as any).customers).toThrow(
			"STRIPE_SECRET_KEY environment variable is not set",
		);
	});

	it("returns STRIPE_PRICE_ID_SUBSCRIPTION when present", async () => {
		process.env.STRIPE_PRICE_ID_SUBSCRIPTION = "price_123";
		const { getStripePriceId } = await import("../convex/stripe");

		expect(getStripePriceId()).toBe("price_123");
	});

	it("throws when STRIPE_PRICE_ID_SUBSCRIPTION is missing", async () => {
		delete process.env.STRIPE_PRICE_ID_SUBSCRIPTION;
		const { getStripePriceId } = await import("../convex/stripe");

		expect(() => getStripePriceId()).toThrow(
			"STRIPE_PRICE_ID_SUBSCRIPTION environment variable is not set",
		);
	});

	it("initializes Stripe only once (lazy singleton)", async () => {
		process.env.STRIPE_SECRET_KEY = "sk_test_123";
		const { stripe } = await import("../convex/stripe");

		const customers = (stripe as any).customers;
		const checkout = (stripe as any).checkout;

		expect(customers).toBeDefined();
		expect(checkout).toBeDefined();
		expect(stripeCtorMock).toHaveBeenCalledOnce();
		expect(stripeCtorMock).toHaveBeenCalledWith("sk_test_123", {
			apiVersion: "2025-12-15.clover",
			typescript: true,
		});
	});
});
