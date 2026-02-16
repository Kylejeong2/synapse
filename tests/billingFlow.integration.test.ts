import { describe, expect, it, vi } from 'vitest';

vi.mock('../convex/_generated/api', () => ({
	api: {
		stripeWebhooks: {
			beginWebhookEventProcessing: 'stripeWebhooks:beginWebhookEventProcessing',
			markWebhookEventProcessed: 'stripeWebhooks:markWebhookEventProcessed',
			markWebhookEventFailed: 'stripeWebhooks:markWebhookEventFailed',
			upsertSubscriptionFromStripe: 'stripeWebhooks:upsertSubscriptionFromStripe',
			updateSubscriptionByStripeIds: 'stripeWebhooks:updateSubscriptionByStripeIds',
			getUserIdByStripeCustomerId: 'stripeWebhooks:getUserIdByStripeCustomerId',
			logBillingAlert: 'stripeWebhooks:logBillingAlert',
		},
	},
}));

describe('billing flow integration (mocked)', () => {
	it('processes checkout completion then invoice finalization/payment for same subscription', async () => {
		const mutation = vi
			.fn()
			.mockResolvedValueOnce({ proceed: true, state: 'new' })
			.mockResolvedValueOnce({ action: 'inserted' })
			.mockResolvedValueOnce({ success: true })
			.mockResolvedValueOnce({ proceed: true, state: 'new' })
			.mockResolvedValueOnce({ updated: true })
			.mockResolvedValueOnce({ success: true })
			.mockResolvedValueOnce({ proceed: true, state: 'new' })
			.mockResolvedValueOnce({ updated: true })
			.mockResolvedValueOnce({ success: true });

		const query = vi.fn(async () => null);
		const convexClient = { mutation, query } as any;
		const stripe = {
			subscriptions: {
				retrieve: vi.fn(async () => ({
					id: 'sub_1',
					customer: 'cus_1',
					status: 'active',
					cancel_at_period_end: false,
					current_period_start: 1,
					current_period_end: 2,
				})),
			},
		} as any;

		const { handleStripeEvent } = await import('../src/lib/server/stripeWebhookProcessor');

		await handleStripeEvent({
			convexClient,
			stripe,
			event: {
				id: 'evt_checkout',
				type: 'checkout.session.completed',
				created: 1,
				data: {
					object: {
						metadata: { clerkUserId: 'user_1' },
						subscription: 'sub_1',
					},
				},
			} as any,
			payload: '{}',
		});

		await handleStripeEvent({
			convexClient,
			stripe,
			event: {
				id: 'evt_invoice_open',
				type: 'invoice.finalized',
				created: 2,
				data: {
					object: {
						subscription: 'sub_1',
						customer: 'cus_1',
					},
				},
			} as any,
			payload: '{}',
		});

		await handleStripeEvent({
			convexClient,
			stripe,
			event: {
				id: 'evt_invoice_paid',
				type: 'invoice.paid',
				created: 3,
				data: {
					object: {
						subscription: 'sub_1',
						customer: 'cus_1',
					},
				},
			} as any,
			payload: '{}',
		});

		expect(mutation).toHaveBeenCalledWith(
			'stripeWebhooks:upsertSubscriptionFromStripe',
			expect.objectContaining({ userId: 'user_1', stripeSubscriptionId: 'sub_1' }),
		);
		expect(mutation).toHaveBeenCalledWith(
			'stripeWebhooks:updateSubscriptionByStripeIds',
			expect.objectContaining({
				stripeSubscriptionId: 'sub_1',
				lastInvoicePaymentStatus: 'open',
			}),
		);
		expect(mutation).toHaveBeenCalledWith(
			'stripeWebhooks:updateSubscriptionByStripeIds',
			expect.objectContaining({
				stripeSubscriptionId: 'sub_1',
				lastInvoicePaymentStatus: 'paid',
				status: 'active',
			}),
		);
	});
});
