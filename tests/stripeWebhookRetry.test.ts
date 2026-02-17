import { beforeEach, describe, expect, it, vi } from 'vitest';

const eventsRetrieveMock = vi.fn();

vi.mock('../convex/stripe', () => ({
	stripe: {
		events: { retrieve: eventsRetrieveMock },
		subscriptions: { retrieve: vi.fn() },
	},
}));

vi.mock('../convex/_generated/server', () => ({
	internalMutation: (opts: { handler: Function }) => opts,
	internalQuery: (opts: { handler: Function }) => opts,
	internalAction: (opts: { handler: Function }) => opts,
	mutation: (opts: { handler: Function }) => opts,
	query: (opts: { handler: Function }) => opts,
}));

vi.mock('../convex/_generated/api', () => ({
	internal: {
		stripeWebhooks: {
			listFailedWebhookEvents: 'stripeWebhooks:listFailedWebhookEvents',
			beginWebhookEventProcessing: 'stripeWebhooks:beginWebhookEventProcessing',
			updateSubscriptionByStripeIds: 'stripeWebhooks:updateSubscriptionByStripeIds',
			markWebhookEventProcessed: 'stripeWebhooks:markWebhookEventProcessed',
			markWebhookEventFailed: 'stripeWebhooks:markWebhookEventFailed',
			getUserIdByStripeCustomerId: 'stripeWebhooks:getUserIdByStripeCustomerId',
			upsertSubscriptionFromStripe: 'stripeWebhooks:upsertSubscriptionFromStripe',
			logBillingAlert: 'stripeWebhooks:logBillingAlert',
		},
	},
}));

describe('stripeWebhooks.retryFailedWebhookEvents', () => {
	beforeEach(() => {
		vi.resetModules();
		eventsRetrieveMock.mockReset();
	});

	it('retries unresolved failures and marks processed on success', async () => {
		eventsRetrieveMock.mockResolvedValueOnce({
			id: 'evt_retry_1',
			type: 'invoice.finalized',
			created: 100,
			data: {
				object: {
					subscription: 'sub_1',
					customer: 'cus_1',
				},
			},
		});

		const runQuery = vi.fn(async (ref: string) => {
			if (ref === 'stripeWebhooks:listFailedWebhookEvents') {
				return [
					{
						eventId: 'evt_retry_1',
						type: 'invoice.finalized',
					},
				];
			}
			return null;
		});

		const runMutation = vi
			.fn()
			.mockResolvedValueOnce({ proceed: true, state: 'retry' })
			.mockResolvedValueOnce({ updated: true })
			.mockResolvedValueOnce({ success: true });

		const { retryFailedWebhookEvents } = await import('../convex/stripeWebhooks');
		const result = await (retryFailedWebhookEvents as any).handler(
			{ runQuery, runMutation },
			{ limit: 10 },
		);

		expect(eventsRetrieveMock).toHaveBeenCalledWith('evt_retry_1');
		expect(runMutation).toHaveBeenCalledWith(
			'stripeWebhooks:updateSubscriptionByStripeIds',
			expect.objectContaining({
				stripeSubscriptionId: 'sub_1',
				lastInvoicePaymentStatus: 'open',
			}),
		);
		expect(runMutation).toHaveBeenCalledWith(
			'stripeWebhooks:markWebhookEventProcessed',
			{ eventId: 'evt_retry_1' },
		);
		expect(result).toEqual({ scanned: 1, retried: 1, processed: 1, errors: 0 });
	});
});
