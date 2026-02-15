import { beforeEach, describe, expect, it, vi } from "vitest";

type StripeCustomer = { id: string; metadata?: Record<string, string> };

type StripeModule = {
	stripe: {
		customers: {
			list: (args: { limit: number }) => Promise<{ data: StripeCustomer[] }>;
			create: (args: {
				email?: string;
				metadata?: Record<string, string>;
			}) => Promise<StripeCustomer>;
		};
		checkout: {
			sessions: {
				create: (args: Record<string, unknown>) => Promise<{
					id: string;
					url: string;
				}>;
			};
		};
	};
	getStripePriceId: () => string;
};

const mockStripe: StripeModule["stripe"] = {
	customers: {
		list: vi.fn(async () => ({ data: [] })),
		create: vi.fn(async () => ({ id: "cus_new" })),
	},
	checkout: {
		sessions: {
			create: vi.fn(async () => ({ id: "cs_test", url: "https://stripe/checkout" })),
		},
	},
};

vi.mock("../convex/stripe", async () => {
	return {
		stripe: mockStripe,
		getStripePriceId: () => "price_test",
	};
});

type DbQuery = {
	withIndex: () => DbQuery;
	filter: () => DbQuery;
	first: () => Promise<unknown>;
};

function createCtx({
	existingSubscription = null,
}: {
	existingSubscription?: unknown;
}) {
	const query: DbQuery = {
		withIndex: () => query,
		filter: () => query,
		first: vi.fn(async () => existingSubscription),
	};

	return {
		db: {
			query: vi.fn(() => query),
		},
	};
}

describe("Stripe checkout session", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		delete process.env.SERVER_URL;
		(mockStripe.customers.list as any).mockResolvedValue({ data: [] });
		(mockStripe.customers.create as any).mockResolvedValue({ id: "cus_new" });
		(mockStripe.checkout.sessions.create as any).mockResolvedValue({
			id: "cs_test",
			url: "https://stripe/checkout",
		});
	});

	it("creates a new customer when no existing customer matches", async () => {
		const { createCheckoutSession } = await import("../convex/subscriptions");
		const ctx = createCtx({ existingSubscription: null });

		const result = await (createCheckoutSession as any)._handler(ctx as any, {
			userId: "user_1",
			userEmail: "user@example.com",
		});

		expect(mockStripe.customers.list).toHaveBeenCalledOnce();
		expect(mockStripe.customers.create).toHaveBeenCalledWith({
			email: "user@example.com",
			metadata: { clerkUserId: "user_1" },
		});
		expect(mockStripe.checkout.sessions.create).toHaveBeenCalledOnce();
		expect(result.url).toBe("https://stripe/checkout");
		expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				customer: "cus_new",
				line_items: [{ price: "price_test" }],
				mode: "subscription",
				success_url: "http://localhost:3000/pricing?success=true",
				cancel_url: "http://localhost:3000/pricing?canceled=true",
				metadata: { clerkUserId: "user_1" },
			}),
		);
	});

	it("reuses existing customer by metadata match", async () => {
		(mockStripe.customers.list as any).mockResolvedValueOnce({
			data: [{ id: "cus_existing", metadata: { clerkUserId: "user_2" } }],
		});

		const { createCheckoutSession } = await import("../convex/subscriptions");
		const ctx = createCtx({ existingSubscription: null });

		const result = await (createCheckoutSession as any)._handler(ctx as any, {
			userId: "user_2",
			userEmail: "existing@example.com",
		});

		expect(mockStripe.customers.create).not.toHaveBeenCalled();
		expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				customer: "cus_existing",
				mode: "subscription",
			}),
		);
		expect(result.sessionId).toBe("cs_test");
	});

	it("uses SERVER_URL when constructing Stripe redirect URLs", async () => {
		process.env.SERVER_URL = "https://app.example.com";
		const { createCheckoutSession } = await import("../convex/subscriptions");
		const ctx = createCtx({ existingSubscription: null });

		await (createCheckoutSession as any)._handler(ctx as any, {
			userId: "user_custom_url",
			userEmail: "custom@example.com",
		});

		expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				success_url: "https://app.example.com/pricing?success=true",
				cancel_url: "https://app.example.com/pricing?canceled=true",
			}),
		);
	});

	it("propagates Stripe API errors", async () => {
		(mockStripe.customers.list as any).mockRejectedValueOnce(
			new Error("Stripe unavailable"),
		);
		const { createCheckoutSession } = await import("../convex/subscriptions");
		const ctx = createCtx({ existingSubscription: null });

		await expect(
			(createCheckoutSession as any)._handler(ctx as any, {
				userId: "user_4",
				userEmail: "user4@example.com",
			}),
		).rejects.toThrow("Stripe unavailable");
	});

	it("throws if user already has an active subscription", async () => {
		const { createCheckoutSession } = await import("../convex/subscriptions");
		const ctx = createCtx({ existingSubscription: { _id: "sub_1" } });

		await expect(
			(createCheckoutSession as any)._handler(ctx as any, {
				userId: "user_3",
				userEmail: "blocked@example.com",
			}),
		).rejects.toThrow("User already has an active subscription");
	});
});
