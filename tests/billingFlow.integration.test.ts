import { describe, expect, it, vi } from 'vitest';

vi.mock('../convex/_generated/api', () => ({
	api: {
		stripeWebhooks: {
			processWebhookEvent: 'stripeWebhooks:processWebhookEvent',
		},
	},
}));

describe('billing flow integration (mocked)', () => {
	it('processes checkout completion then invoice finalization/payment for same subscription', async () => {
		process.env.STRIPE_WEBHOOK_CONVEX_TOKEN = 'webhook_token';
		const action = vi
			.fn()
			.mockResolvedValueOnce({ duplicate: false })
			.mockResolvedValueOnce({ duplicate: false })
			.mockResolvedValueOnce({ duplicate: false });

		const query = vi.fn(async () => null);
		const convexClient = { action, query } as any;

		const { handleStripeEvent } = await import('../src/lib/server/stripeWebhookProcessor');

		await handleStripeEvent({
			convexClient,
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

		expect(action).toHaveBeenCalledTimes(3);
		expect(action).toHaveBeenNthCalledWith(
			1,
			'stripeWebhooks:processWebhookEvent',
			expect.objectContaining({
				token: 'webhook_token',
				event: expect.objectContaining({ id: 'evt_checkout' }),
			}),
		);
		expect(action).toHaveBeenNthCalledWith(
			2,
			'stripeWebhooks:processWebhookEvent',
			expect.objectContaining({
				token: 'webhook_token',
				event: expect.objectContaining({ id: 'evt_invoice_open' }),
			}),
		);
		expect(action).toHaveBeenNthCalledWith(
			3,
			'stripeWebhooks:processWebhookEvent',
			expect.objectContaining({
				token: 'webhook_token',
				event: expect.objectContaining({ id: 'evt_invoice_paid' }),
			}),
		);
	});
});
