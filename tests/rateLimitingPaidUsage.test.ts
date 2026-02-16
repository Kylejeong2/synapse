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
});
