import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../convex/_generated/server', () => ({
	query: (opts: { handler: Function }) => opts,
	mutation: (opts: { handler: Function }) => opts,
}));

vi.mock('convex/values', () => ({
	v: {
		string: () => 'string',
		number: () => 'number',
		boolean: () => 'boolean',
		optional: (x: unknown) => x,
		array: (x: unknown) => x,
		object: (x: unknown) => x,
	},
}));

function makeQuery(firstValue: unknown) {
	return {
		withIndex: () => ({
			first: vi.fn(async () => firstValue),
			filter: () => ({
				first: vi.fn(async () => firstValue),
			}),
		}),
	};
}

describe('tokenPricing admin mutations', () => {
	beforeEach(() => {
		vi.resetModules();
		process.env.BILLING_ADMIN_USER_IDS = 'admin_1';
	});

	it('upsertModelPricing rejects non-admin users', async () => {
		const db = {
			query: vi.fn(() => makeQuery(null)),
			insert: vi.fn(),
			patch: vi.fn(),
		};
		const { upsertModelPricing } = await import('../convex/tokenPricing');
		await expect(
			(upsertModelPricing as any).handler(
				{ db, auth: { getUserIdentity: vi.fn(async () => ({ subject: 'user_2' })) } },
				{
					model: 'gpt-5',
					providerCostPer1kInput: 0.01,
					providerCostPer1kOutput: 0.03,
					markupMultiplier: 2,
				},
			),
		).rejects.toThrow('Forbidden');
	});

	it('upsertModelPricing computes and inserts token prices', async () => {
		const insert = vi.fn(async () => 'pricing_1');
		const db = {
			query: vi.fn(() => makeQuery(null)),
			insert,
			patch: vi.fn(),
		};
		const { upsertModelPricing } = await import('../convex/tokenPricing');

		const result = await (upsertModelPricing as any).handler(
			{ db, auth: { getUserIdentity: vi.fn(async () => ({ subject: 'admin_1' })) } },
			{
				model: 'gpt-5',
				providerCostPer1kInput: 0.01,
				providerCostPer1kOutput: 0.03,
				providerCostPer1kThinking: 0.02,
				markupMultiplier: 2.5,
				isActive: true,
			},
		);

		expect(result).toEqual({ action: 'inserted' });
		expect(insert).toHaveBeenCalledWith(
			'token_pricing',
			expect.objectContaining({
				model: 'gpt-5',
				pricePerTokenInput: 0.000025,
				pricePerTokenOutput: 0.000075,
				pricePerTokenThinking: 0.00005,
			}),
		);
	});

	it('bulkUpsertModelPricing returns aggregate counts', async () => {
		const insert = vi.fn(async () => 'pricing_new');
		const patch = vi.fn(async () => undefined);
		const db = {
			query: vi
				.fn()
				.mockImplementationOnce(() => makeQuery({ _id: 'existing_1' }))
				.mockImplementationOnce(() => makeQuery(null)),
			insert,
			patch,
		};
		const { bulkUpsertModelPricing } = await import('../convex/tokenPricing');

		const result = await (bulkUpsertModelPricing as any).handler(
			{ db, auth: { getUserIdentity: vi.fn(async () => ({ subject: 'admin_1' })) } },
			{
				rows: [
					{
						model: 'model_existing',
						providerCostPer1kInput: 0.01,
						providerCostPer1kOutput: 0.03,
						markupMultiplier: 2,
					},
					{
						model: 'model_new',
						providerCostPer1kInput: 0.005,
						providerCostPer1kOutput: 0.01,
						markupMultiplier: 3,
					},
				],
			},
		);

		expect(result).toEqual({ inserted: 1, updated: 1, total: 2 });
		expect(patch).toHaveBeenCalledTimes(1);
		expect(insert).toHaveBeenCalledTimes(1);
	});

	it('seedDefaultModelPricing upserts all canonical model rows', async () => {
		const insert = vi.fn(async () => 'pricing_seed');
		const db = {
			query: vi.fn(() => makeQuery(null)),
			insert,
			patch: vi.fn(),
		};
		const { seedDefaultModelPricing } = await import('../convex/tokenPricing');
		const { DEFAULT_TOKEN_PRICING_ROWS } = await import('../convex/defaultTokenPricing');

		const result = await (seedDefaultModelPricing as any).handler(
			{ db, auth: { getUserIdentity: vi.fn(async () => ({ subject: 'admin_1' })) } },
			{},
		);

		expect(result).toEqual({
			inserted: DEFAULT_TOKEN_PRICING_ROWS.length,
			updated: 0,
			total: DEFAULT_TOKEN_PRICING_ROWS.length,
		});
		expect(insert).toHaveBeenCalledTimes(DEFAULT_TOKEN_PRICING_ROWS.length);
	});
});
