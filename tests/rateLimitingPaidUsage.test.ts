import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../convex/_generated/server', () => ({
	query: (opts: { handler: Function }) => opts,
}));

vi.mock('convex/values', () => ({
	v: {
		string: () => 'string',
		number: () => 'number',
		optional: (x: unknown) => x,
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

describe('checkTokenLimit paid-tier overage behavior', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('allows paid requests even when included credit is exhausted', async () => {
		const subscription = {
			_id: 'sub_1',
			status: 'active',
			includedTokenCredit: 10,
		};
		const cycle = {
			tokenCost: 14,
			includedCredit: 10,
		};

		const db = {
			query: vi
				.fn()
				.mockImplementationOnce(() => makeQuery(subscription))
				.mockImplementationOnce(() => makeQuery(cycle)),
		};

		const { checkTokenLimit } = await import('../convex/rateLimiting');
		const result = await (checkTokenLimit as any).handler(
			{ db },
			{ userId: 'user_1', requestedTokens: 10_000 },
		);

		expect(result.allowed).toBe(true);
		expect(result.remainingCredit).toBe(-4);
		expect(result.projectedOverage).toBeGreaterThan(0);
	});

	it('blocks paid requests when monthly spend cap would be exceeded', async () => {
		const subscription = {
			_id: 'sub_1',
			status: 'active',
			includedTokenCredit: 10,
			monthlySpendCap: 12,
		};
		const cycle = {
			tokenCost: 11.9,
			includedCredit: 10,
		};

		const db = {
			query: vi
				.fn()
				.mockImplementationOnce(() => makeQuery(subscription))
				.mockImplementationOnce(() => makeQuery(cycle)),
		};

		const { checkTokenLimit } = await import('../convex/rateLimiting');
		const result = await (checkTokenLimit as any).handler(
			{ db },
			{ userId: 'user_1', requestedTokens: 10_000 },
		);

		expect(result.allowed).toBe(false);
		expect(result.reason).toBe('spend_cap_exceeded');
		expect(result.monthlySpendCap).toBe(12);
	});

	it('treats trialing subscriptions as entitled paid tier', async () => {
		const subscription = {
			_id: 'sub_trial',
			status: 'trialing',
			includedTokenCredit: 10,
		};
		const cycle = {
			tokenCost: 2,
			includedCredit: 10,
		};

		const db = {
			query: vi
				.fn()
				.mockImplementationOnce(() => makeQuery(subscription))
				.mockImplementationOnce(() => makeQuery(cycle)),
		};

		const { checkTokenLimit } = await import('../convex/rateLimiting');
		const result = await (checkTokenLimit as any).handler(
			{ db },
			{ userId: 'user_trial', requestedTokens: 1000 },
		);

		expect(result.allowed).toBe(true);
		expect(result.remainingCredit).toBe(8);
	});

	it('uses token_pricing model data for spend-cap estimation when available', async () => {
		const subscription = {
			_id: 'sub_1',
			status: 'active',
			includedTokenCredit: 10,
			monthlySpendCap: 10.1,
		};
		const cycle = {
			tokenCost: 10.0,
			includedCredit: 10,
		};
		const pricing = {
			pricePerTokenInput: 0.00004,
			pricePerTokenOutput: 0.00001,
			pricePerTokenThinking: 0.00002,
			isActive: true,
		};

		const db = {
			query: vi
				.fn()
				.mockImplementationOnce(() => makeQuery(subscription))
				.mockImplementationOnce(() => makeQuery(cycle))
				.mockImplementationOnce(() => makeQuery(pricing)),
		};

		const { checkTokenLimit } = await import('../convex/rateLimiting');
		const result = await (checkTokenLimit as any).handler(
			{ db },
			{
				userId: 'user_1',
				requestedTokens: 3000,
				model: 'gpt-5.2-2025-12-11',
			},
		);

		expect(result.allowed).toBe(false);
		expect(result.reason).toBe('spend_cap_exceeded');
		// max per-1k from pricing is input: 0.04, estimate for 3k = 0.12
		expect(result.estimatedCost).toBeCloseTo(0.12, 5);
	});
});
