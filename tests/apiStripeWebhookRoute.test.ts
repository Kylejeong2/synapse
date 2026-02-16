import { beforeEach, describe, expect, it, vi } from 'vitest';

const mutationMock = vi.fn();
const constructEventMock = vi.fn();
const retrieveSubscriptionMock = vi.fn();

vi.mock('convex/browser', () => ({
	ConvexHttpClient: vi.fn(function ConvexHttpClientMock() {
		return {
			mutation: mutationMock,
			query: vi.fn(async () => null),
		};
	}),
}));

vi.mock('@tanstack/react-router', () => ({
	createFileRoute: () => (options: unknown) => options,
}));

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

vi.mock('stripe', () => {
	return {
		default: vi.fn(function StripeCtorMock() {
			return {
				webhooks: { constructEvent: constructEventMock },
				subscriptions: { retrieve: retrieveSubscriptionMock },
			};
		}),
	};
});

async function getPostHandler() {
	vi.resetModules();
	(import.meta as any).env = {
		...import.meta.env,
		VITE_CONVEX_URL: 'https://convex.example.com',
	};
	process.env.STRIPE_SECRET_KEY = 'sk_test_123';
	process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';
	const mod = await import('../src/routes/api.stripe-webhook');
	return (mod.Route as any).server.handlers.POST as (args: {
		request: Request;
	}) => Promise<Response>;
}

describe('POST /api/stripe-webhook', () => {
	beforeEach(() => {
		mutationMock.mockReset();
		constructEventMock.mockReset();
		retrieveSubscriptionMock.mockReset();
	});

	it('returns 400 when stripe signature header is missing', async () => {
		const post = await getPostHandler();
		const response = await post({
			request: new Request('http://localhost/api/stripe-webhook', {
				method: 'POST',
				body: JSON.stringify({}),
			}),
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'Missing Stripe signature',
		});
	});

	it('returns duplicate acknowledgement when event already processed', async () => {
		constructEventMock.mockReturnValue({
			id: 'evt_1',
			type: 'checkout.session.completed',
			created: 1,
			data: { object: {} },
		});
		mutationMock.mockResolvedValueOnce({ proceed: false, state: 'processed' });

		const post = await getPostHandler();
		const response = await post({
			request: new Request('http://localhost/api/stripe-webhook', {
				method: 'POST',
				headers: { 'stripe-signature': 'sig_test' },
				body: JSON.stringify({ id: 'evt_1' }),
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			received: true,
			duplicate: true,
		});
		expect(mutationMock).toHaveBeenCalledWith(
			'stripeWebhooks:beginWebhookEventProcessing',
			expect.objectContaining({ eventId: 'evt_1' }),
		);
	});

	it('processes invoice.payment_failed and marks event processed', async () => {
		constructEventMock.mockReturnValue({
			id: 'evt_2',
			type: 'invoice.payment_failed',
			created: 2,
			data: {
				object: {
					subscription: 'sub_test',
					customer: 'cus_test',
				},
			},
		});
		mutationMock
			.mockResolvedValueOnce({ proceed: true, state: 'new' })
			.mockResolvedValueOnce({ updated: true })
			.mockResolvedValueOnce({ success: true });

		const post = await getPostHandler();
		const response = await post({
			request: new Request('http://localhost/api/stripe-webhook', {
				method: 'POST',
				headers: { 'stripe-signature': 'sig_test' },
				body: JSON.stringify({ id: 'evt_2' }),
			}),
		});

		expect(response.status).toBe(200);
		expect(mutationMock).toHaveBeenCalledWith(
			'stripeWebhooks:updateSubscriptionByStripeIds',
			expect.objectContaining({
				stripeSubscriptionId: 'sub_test',
				status: 'past_due',
				lastInvoicePaymentStatus: 'failed',
			}),
		);
		expect(mutationMock).toHaveBeenCalledWith(
			'stripeWebhooks:markWebhookEventProcessed',
			{ eventId: 'evt_2' },
		);
	});
});
