import { beforeEach, describe, expect, it, vi } from 'vitest';

type StripeCustomer = { id: string; metadata?: Record<string, string> };

type StripeModule = {
	stripe: {
		customers: {
			list: (args: { email?: string; limit: number }) => Promise<{ data: StripeCustomer[] }>;
			create: (args: {
				email?: string;
				metadata?: Record<string, string>;
			}) => Promise<StripeCustomer>;
			update: (id: string, args: { metadata?: Record<string, string> }) => Promise<StripeCustomer>;
		};
		checkout: {
			sessions: {
				create: (args: Record<string, unknown>) => Promise<{
					id: string;
					url: string;
				}>;
			};
		};
		prices: {
			retrieve: (id: string) => Promise<{
				id: string;
				active: boolean;
				recurring: Record<string, unknown> | null;
				unit_amount: number | null;
			}>;
		};
	};
	getStripePriceId: () => string;
};

const mockStripe: StripeModule['stripe'] = {
	customers: {
		list: vi.fn(async () => ({ data: [] })),
		create: vi.fn(async () => ({ id: 'cus_new' })),
		update: vi.fn(async () => ({ id: 'cus_updated' })),
	},
	checkout: {
		sessions: {
			create: vi.fn(async () => ({ id: 'cs_test', url: 'https://stripe/checkout' })),
		},
	},
	prices: {
		retrieve: vi.fn(async (id: string) => ({
			id,
			active: true,
			recurring: { interval: 'month' },
			unit_amount: 2000,
		})),
	},
};

vi.mock('../convex/stripe', async () => {
	return {
		stripe: mockStripe,
		getStripePriceId: () => 'price_test',
	};
});

function createCtx({
	existingSubscription = null,
	mappedCustomer = null,
}: {
	existingSubscription?: unknown;
	mappedCustomer?: unknown;
}) {
	return {
		db: {
			query: vi.fn((table: string) => {
				if (table === 'subscriptions') {
					return {
						withIndex: () => ({
							first: vi.fn(async () => existingSubscription),
							filter: () => ({
								first: vi.fn(async () => existingSubscription),
							}),
						}),
					};
				}
				if (table === 'billing_customers') {
					return {
						withIndex: () => ({
							first: vi.fn(async () => mappedCustomer),
						}),
					};
				}
				throw new Error(`Unexpected table: ${table}`);
			}),
			insert: vi.fn(async () => 'billing_customer_1'),
			patch: vi.fn(async () => undefined),
		},
	};
}

describe('Stripe checkout session', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		delete process.env.SERVER_URL;
		(mockStripe.customers.list as any).mockResolvedValue({ data: [] });
		(mockStripe.customers.create as any).mockResolvedValue({ id: 'cus_new' });
		(mockStripe.prices.retrieve as any).mockResolvedValue({
			id: 'price_test',
			active: true,
			recurring: { interval: 'month' },
			unit_amount: 2000,
		});
		(mockStripe.checkout.sessions.create as any).mockResolvedValue({
			id: 'cs_test',
			url: 'https://stripe/checkout',
		});
	});

	it('creates a new customer when no local mapping or email customer exists', async () => {
		const { createCheckoutSession } = await import('../convex/subscriptions');
		const ctx = createCtx({ existingSubscription: null, mappedCustomer: null });

		const result = await (createCheckoutSession as any)._handler(ctx as any, {
			userId: 'user_1',
			userEmail: 'user@example.com',
		});

		expect(mockStripe.customers.list).toHaveBeenCalledWith({
			email: 'user@example.com',
			limit: 1,
		});
		expect(mockStripe.customers.create).toHaveBeenCalledWith({
			email: 'user@example.com',
			metadata: { clerkUserId: 'user_1' },
		});
		expect(mockStripe.checkout.sessions.create).toHaveBeenCalledOnce();
		expect(result.url).toBe('https://stripe/checkout');
		expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				customer: 'cus_new',
				line_items: [{ price: 'price_test' }],
				mode: 'subscription',
				success_url: 'http://localhost:3000/pricing?success=true',
				cancel_url: 'http://localhost:3000/pricing?canceled=true',
				metadata: { clerkUserId: 'user_1' },
			}),
		);
	});

	it('reuses mapped customer from billing_customers table', async () => {
		const { createCheckoutSession } = await import('../convex/subscriptions');
		const ctx = createCtx({
			existingSubscription: null,
			mappedCustomer: { stripeCustomerId: 'cus_mapped' },
		});

		await (createCheckoutSession as any)._handler(ctx as any, {
			userId: 'user_2',
			userEmail: 'mapped@example.com',
		});

		expect(mockStripe.customers.list).not.toHaveBeenCalled();
		expect(mockStripe.customers.create).not.toHaveBeenCalled();
		expect(mockStripe.prices.retrieve).toHaveBeenCalledWith('price_test');
		expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				customer: 'cus_mapped',
			}),
		);
	});

	it('uses SERVER_URL when constructing Stripe redirect URLs', async () => {
		process.env.SERVER_URL = 'https://app.example.com';
		const { createCheckoutSession } = await import('../convex/subscriptions');
		const ctx = createCtx({ existingSubscription: null, mappedCustomer: null });

		await (createCheckoutSession as any)._handler(ctx as any, {
			userId: 'user_custom_url',
			userEmail: 'custom@example.com',
		});

		expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
			expect.objectContaining({
				success_url: 'https://app.example.com/pricing?success=true',
				cancel_url: 'https://app.example.com/pricing?canceled=true',
			}),
		);
	});

	it('propagates Stripe API errors', async () => {
		(mockStripe.customers.list as any).mockRejectedValueOnce(
			new Error('Stripe unavailable'),
		);
		const { createCheckoutSession } = await import('../convex/subscriptions');
		const ctx = createCtx({ existingSubscription: null, mappedCustomer: null });

		await expect(
			(createCheckoutSession as any)._handler(ctx as any, {
				userId: 'user_4',
				userEmail: 'user4@example.com',
			}),
		).rejects.toThrow('Stripe unavailable');
	});

	it('throws if user already has an existing subscription', async () => {
		const { createCheckoutSession } = await import('../convex/subscriptions');
		const ctx = createCtx({
			existingSubscription: { _id: 'sub_1', status: 'active' },
			mappedCustomer: null,
		});

		await expect(
			(createCheckoutSession as any)._handler(ctx as any, {
				userId: 'user_3',
				userEmail: 'blocked@example.com',
			}),
		).rejects.toThrow('User already has an existing subscription');
	});

	it('fails checkout when Stripe catalog price mismatches product price constant', async () => {
		(mockStripe.prices.retrieve as any).mockResolvedValueOnce({
			id: 'price_test',
			active: true,
			recurring: { interval: 'month' },
			unit_amount: 999,
		});
		const { createCheckoutSession } = await import('../convex/subscriptions');
		const ctx = createCtx({ existingSubscription: null, mappedCustomer: null });

		await expect(
			(createCheckoutSession as any)._handler(ctx as any, {
				userId: 'user_mismatch',
				userEmail: 'mismatch@example.com',
			}),
		).rejects.toThrow('Stripe price mismatch');
	});
});
