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
			take: vi.fn(async () => []),
			filter: () => ({
				first: vi.fn(async () => firstValue),
			}),
		}),
	};
}

describe('usage metering retry queue', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('enqueueUsageMeteringJob inserts a pending job when none exists for node', async () => {
		const insert = vi.fn(async () => 'job_1');
		const db = {
			query: vi.fn(() => makeQuery(null)),
			get: vi
				.fn()
				.mockResolvedValueOnce({ _id: 'conv_1', userId: 'user_1' })
				.mockResolvedValueOnce({ _id: 'node_1', conversationId: 'conv_1' }),
			insert,
			patch: vi.fn(),
		};
		const { enqueueUsageMeteringJob } = await import('../convex/usage');

		const result = await (enqueueUsageMeteringJob as any).handler(
			{ db, auth: { getUserIdentity: vi.fn(async () => ({ subject: 'user_1' })) } },
			{
				conversationId: 'conv_1',
				nodeId: 'node_1',
				model: 'gpt-5.2-2025-12-11',
				tokensUsed: 1200,
				inputTokens: 500,
				outputTokens: 700,
				thinkingTokens: 0,
				tokenCost: 0.5,
			},
		);

		expect(result.queued).toBe(true);
		expect(result.status).toBe('inserted');
		expect(insert).toHaveBeenCalledWith(
			'usage_metering_jobs',
			expect.objectContaining({
				status: 'pending',
				nodeId: 'node_1',
			}),
		);
	});

	it('processUsageMeteringJob dead-letters after max retries and emits billing alert', async () => {
		const patch = vi.fn(async () => undefined);
		const insert = vi.fn(async () => 'alert_1');
		const db = {
			get: vi.fn(async () => ({
				_id: 'job_1',
				userId: 'user_1',
				conversationId: 'conv_1',
				nodeId: 'node_1',
				model: 'unknown-model',
				tokensUsed: 100,
				inputTokens: 10,
				outputTokens: 20,
				thinkingTokens: 0,
				status: 'failed',
				attempts: 7,
				nextRetryAt: Date.now(),
				createdAt: Date.now(),
				updatedAt: Date.now(),
			})),
			query: vi
				.fn()
				// usage_records lookup by nodeId
				.mockImplementationOnce(() => makeQuery(null))
				// token_pricing lookup
				.mockImplementationOnce(() => makeQuery(null)),
			patch,
			insert,
		};
		const { processUsageMeteringJob } = await import('../convex/usage');

		const result = await (processUsageMeteringJob as any).handler(
			{ db },
			{ jobId: 'job_1' },
		);

		expect(result).toEqual({
			processed: false,
			status: 'dead_letter',
		});
		expect(patch).toHaveBeenCalledWith(
			'job_1',
			expect.objectContaining({
				status: 'dead_letter',
			}),
		);
		expect(insert).toHaveBeenCalledWith(
			'billing_alerts',
			expect.objectContaining({
				source: 'invoice',
				severity: 'error',
			}),
		);
	});
});
