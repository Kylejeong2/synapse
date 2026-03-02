import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../convex/_generated/server', () => ({
	mutation: (opts: { handler: Function }) => opts,
	query: (opts: { handler: Function }) => opts,
	internalMutation: (opts: { handler: Function }) => opts,
	internalQuery: (opts: { handler: Function }) => opts,
	internalAction: (opts: { handler: Function }) => opts,
}));

function makeQuery(firstValue: unknown) {
	return {
		withIndex: () => ({
			first: vi.fn(async () => firstValue),
			collect: vi.fn(async () =>
				Array.isArray(firstValue) ? firstValue : firstValue ? [firstValue] : [],
			),
			filter: () => ({
				first: vi.fn(async () => firstValue),
				collect: vi.fn(async () =>
					Array.isArray(firstValue) ? firstValue : firstValue ? [firstValue] : [],
				),
			}),
		}),
	};
}

describe('usage.recordUsage pricing behavior', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('computes tokenCost from token_pricing when active model pricing exists', async () => {
		const subscription = {
			_id: 'sub_1',
			status: 'active',
			currentPeriodStart: 1,
			currentPeriodEnd: 2,
			includedTokenCredit: 10,
		};
		const pricing = {
			pricePerTokenInput: 0.000002,
			pricePerTokenOutput: 0.00001,
			pricePerTokenThinking: 0.00001,
			isActive: true,
		};

		const insert = vi
			.fn()
			.mockResolvedValueOnce('cycle_1')
			.mockResolvedValueOnce('usage_1');
		const patch = vi.fn(async () => undefined);
		const query = vi
			.fn()
			.mockImplementationOnce(() => makeQuery(null))
			.mockImplementationOnce(() => makeQuery(pricing))
			.mockImplementationOnce(() => makeQuery(subscription))
			.mockImplementationOnce(() => makeQuery(null));

		const get = vi
			.fn()
			.mockResolvedValueOnce({ _id: 'conv_1', userId: 'user_1' })
			.mockResolvedValueOnce({ _id: 'node_1', conversationId: 'conv_1' });
		const db = { query, insert, patch, get };
		const { recordUsage } = await import('../convex/usage');

		await (recordUsage as any).handler(
			{ db, auth: { getUserIdentity: vi.fn(async () => ({ subject: 'user_1' })) } },
			{
				conversationId: 'conv_1',
				nodeId: 'node_1',
				model: 'gpt-5.2-2025-12-11',
				tokensUsed: 1500,
				inputTokens: 500,
				outputTokens: 900,
				thinkingTokens: 100,
			},
		);

		const expectedCost = 500 * 0.000002 + 900 * 0.00001 + 100 * 0.00001;

		expect(patch).toHaveBeenCalledWith(
			'cycle_1',
			expect.objectContaining({ tokenCost: expectedCost }),
		);
		expect(insert).toHaveBeenLastCalledWith(
			'usage_records',
			expect.objectContaining({ tokenCost: expectedCost }),
		);
	});

	it('falls back to provided tokenCost when token_pricing is missing', async () => {
		const insert = vi.fn(async () => 'usage_1');
		const patch = vi.fn(async () => undefined);
		const query = vi
			.fn()
			.mockImplementationOnce(() => makeQuery(null))
			.mockImplementationOnce(() => makeQuery(null))
			.mockImplementationOnce(() => makeQuery(null))
			.mockImplementationOnce(() => makeQuery(null));
		const get = vi
			.fn()
			.mockResolvedValueOnce({ _id: 'conv_1', userId: 'user_free' })
			.mockResolvedValueOnce({ _id: 'node_1', conversationId: 'conv_1' });
		const db = { query, insert, patch, get };

		const { recordUsage } = await import('../convex/usage');
		await (recordUsage as any).handler(
			{
				db,
				auth: { getUserIdentity: vi.fn(async () => ({ subject: 'user_free' })) },
			},
			{
				conversationId: 'conv_1',
				nodeId: 'node_1',
				model: 'unknown',
				tokensUsed: 100,
				tokenCost: 0.25,
			},
		);

		expect(insert).toHaveBeenCalledWith(
			'usage_records',
			expect.objectContaining({ tokenCost: 0.25 }),
		);
	});

	it('is idempotent per node and does not double-charge usage', async () => {
		const insert = vi.fn(async () => 'usage_2');
		const patch = vi.fn(async () => undefined);
		const query = vi
			.fn()
			.mockImplementationOnce(() =>
				makeQuery({
					_id: 'usage_existing',
					nodeId: 'node_1',
				}),
			);
		const get = vi
			.fn()
			.mockResolvedValueOnce({ _id: 'conv_1', userId: 'user_1' })
			.mockResolvedValueOnce({ _id: 'node_1', conversationId: 'conv_1' });
		const db = { query, insert, patch, get };

		const { recordUsage } = await import('../convex/usage');
		const result = await (recordUsage as any).handler(
			{ db, auth: { getUserIdentity: vi.fn(async () => ({ subject: 'user_1' })) } },
			{
				conversationId: 'conv_1',
				nodeId: 'node_1',
				model: 'gpt-5.2-2025-12-11',
				tokensUsed: 1000,
				tokenCost: 1,
			},
		);

		expect(result).toEqual({ success: true, duplicate: true });
		expect(insert).not.toHaveBeenCalled();
		expect(patch).not.toHaveBeenCalled();
	});
});
