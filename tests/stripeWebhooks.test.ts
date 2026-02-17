import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../convex/_generated/server', () => ({
	mutation: (opts: { handler: Function }) => opts,
	query: (opts: { handler: Function }) => opts,
	internalMutation: (opts: { handler: Function }) => opts,
	internalQuery: (opts: { handler: Function }) => opts,
	internalAction: (opts: { handler: Function }) => opts,
}));

function q(firstValue: unknown) {
	return {
		withIndex: () => ({
			first: vi.fn(async () => firstValue),
		}),
		filter: () => ({
			order: () => ({
				take: vi.fn(async () => []),
			}),
		}),
	};
}

describe('convex/stripeWebhooks', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('processWebhookEvent rejects invalid internal token', async () => {
		process.env.STRIPE_WEBHOOK_CONVEX_TOKEN = 'expected_token';
		const { processWebhookEvent } = await import('../convex/stripeWebhooks');

		await expect(
			(processWebhookEvent as any).handler(
				{ runMutation: vi.fn(), runQuery: vi.fn() },
				{
					token: 'bad_token',
					event: { id: 'evt_unauth', type: 'invoice.paid', created: 1, data: { object: {} } },
				},
			),
		).rejects.toThrow('Unauthorized');
	});

	it('beginWebhookEventProcessing inserts new processing event', async () => {
		const insert = vi.fn(async () => 'evt_doc_1');
		const db = {
			query: vi.fn(() => q(null)),
			insert,
		};
		const { beginWebhookEventProcessing } = await import('../convex/stripeWebhooks');
		const result = await (beginWebhookEventProcessing as any).handler({ db }, {
			eventId: 'evt_1',
			type: 'checkout.session.completed',
			createdAt: 1,
		});

		expect(result).toEqual({ proceed: true, state: 'new' });
		expect(insert).toHaveBeenCalledWith(
			'stripe_events',
			expect.objectContaining({
				eventId: 'evt_1',
				status: 'processing',
				attempts: 1,
			}),
		);
	});

	it('beginWebhookEventProcessing returns duplicate for processed events', async () => {
		const db = {
			query: vi.fn(() => q({ _id: 'e1', status: 'processed', attempts: 1 })),
			patch: vi.fn(),
		};
		const { beginWebhookEventProcessing } = await import('../convex/stripeWebhooks');
		const result = await (beginWebhookEventProcessing as any).handler({ db }, {
			eventId: 'evt_1',
			type: 'customer.subscription.updated',
			createdAt: 1,
		});
		expect(result).toEqual({ proceed: false, state: 'processed' });
	});

	it('markWebhookEventFailed records dead-letter and alert', async () => {
		const patch = vi.fn(async () => undefined);
		const insert = vi.fn(async () => 'doc_1');
		const db = {
			query: vi
				.fn()
				.mockImplementationOnce(() => q({ _id: 'evt_doc', attempts: 2 }))
				.mockImplementationOnce(() => q(null)),
			patch,
			insert,
		};
		const { markWebhookEventFailed } = await import('../convex/stripeWebhooks');
		await (markWebhookEventFailed as any).handler({ db }, {
			eventId: 'evt_2',
			type: 'invoice.paid',
			error: 'boom',
			payload: '{}',
		});

		expect(patch).toHaveBeenCalledWith(
			'evt_doc',
			expect.objectContaining({ status: 'failed', lastError: 'boom' }),
		);
		expect(insert).toHaveBeenCalledWith(
			'stripe_webhook_failures',
			expect.objectContaining({ eventId: 'evt_2', retryCount: 1 }),
		);
		expect(insert).toHaveBeenCalledWith(
			'billing_alerts',
			expect.objectContaining({ source: 'webhook', severity: 'error' }),
		);
	});

	it('upsertSubscriptionFromStripe inserts when no record exists', async () => {
		const insert = vi.fn(async () => 'sub_doc_1');
		const patch = vi.fn(async () => undefined);
		const query = vi
			.fn()
			.mockImplementationOnce(() => q(null))
			.mockImplementationOnce(() => q(null))
			.mockImplementationOnce(() => q(null));
		const db = { query, insert, patch };

		const { upsertSubscriptionFromStripe } = await import('../convex/stripeWebhooks');
		const result = await (upsertSubscriptionFromStripe as any).handler({ db }, {
			userId: 'user_1',
			stripeCustomerId: 'cus_1',
			stripeSubscriptionId: 'sub_1',
			status: 'active',
			currentPeriodStart: 1,
			currentPeriodEnd: 2,
			includedTokenCredit: 10,
		});

		expect(result).toEqual({ action: 'inserted' });
		expect(insert).toHaveBeenCalledWith(
			'subscriptions',
			expect.objectContaining({
				userId: 'user_1',
				stripeSubscriptionId: 'sub_1',
				status: 'active',
			}),
		);
	});

	it('processWebhookEvent logs alerts for refund/dispute/credit note events', async () => {
		process.env.STRIPE_WEBHOOK_CONVEX_TOKEN = 'expected_token';
		const runMutation = vi.fn(async (_ref: unknown, payload: any) => {
			if (payload?.eventId && payload?.type && payload?.createdAt) {
				return { proceed: true, state: 'new' };
			}
			if (payload?.eventId && Object.keys(payload).length === 1) {
				return { success: true };
			}
			return { success: true };
		});
		const runQuery = vi.fn(async () => null);

		const { processWebhookEvent } = await import('../convex/stripeWebhooks');

		await (processWebhookEvent as any).handler(
			{ runMutation, runQuery },
			{
				token: 'expected_token',
				event: {
					id: 'evt_refund',
					type: 'charge.refunded',
					created: 1,
					data: {
						object: {
							id: 'ch_1',
							amount_refunded: 500,
							currency: 'usd',
							customer: 'cus_1',
						},
					},
				},
			},
		);

		await (processWebhookEvent as any).handler(
			{ runMutation, runQuery },
			{
				token: 'expected_token',
				event: {
					id: 'evt_dispute',
					type: 'charge.dispute.created',
					created: 2,
					data: {
						object: {
							id: 'dp_1',
							charge: 'ch_2',
							amount: 700,
							currency: 'usd',
							reason: 'fraudulent',
						},
					},
				},
			},
		);

		await (processWebhookEvent as any).handler(
			{ runMutation, runQuery },
			{
				token: 'expected_token',
				event: {
					id: 'evt_credit_note',
					type: 'credit_note.created',
					created: 3,
					data: {
						object: {
							id: 'cn_1',
							invoice: 'in_1',
							amount: 300,
							currency: 'usd',
						},
					},
				},
			},
		);

		expect(runMutation).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ message: 'Charge refunded' }),
		);
		expect(runMutation).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ message: 'Charge dispute created' }),
		);
		expect(runMutation).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ message: 'Credit note created' }),
		);
	});
});
