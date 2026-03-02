import { beforeEach, describe, expect, it, vi } from 'vitest';

const mutationMock = vi.fn();
const actionMock = vi.fn();
const constructEventMock = vi.fn();
const retrieveSubscriptionMock = vi.fn();

vi.mock('convex/browser', () => ({
	ConvexHttpClient: vi.fn(function ConvexHttpClientMock() {
		return {
			mutation: mutationMock,
			action: actionMock,
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
			processWebhookEvent: 'stripeWebhooks:processWebhookEvent',
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
	process.env.STRIPE_WEBHOOK_CONVEX_TOKEN = 'convex_webhook_token';
	const mod = await import('../src/routes/api.stripe-webhook');
	return (mod.Route as any).server.handlers.POST as (args: {
		request: Request;
	}) => Promise<Response>;
}

describe('POST /api/stripe-webhook', () => {
	beforeEach(() => {
		mutationMock.mockReset();
		actionMock.mockReset();
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
		actionMock.mockResolvedValueOnce({ duplicate: true });

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
		expect(actionMock).toHaveBeenCalledWith(
			'stripeWebhooks:processWebhookEvent',
			expect.objectContaining({
				token: 'convex_webhook_token',
				event: expect.objectContaining({ id: 'evt_1' }),
			}),
		);
	});

	it('processes invoice.payment_failed via convex webhook processor mutation', async () => {
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
		actionMock.mockResolvedValueOnce({ duplicate: false });

		const post = await getPostHandler();
		const response = await post({
			request: new Request('http://localhost/api/stripe-webhook', {
				method: 'POST',
				headers: { 'stripe-signature': 'sig_test' },
				body: JSON.stringify({ id: 'evt_2' }),
			}),
		});

		expect(response.status).toBe(200);
		expect(actionMock).toHaveBeenCalledWith(
			'stripeWebhooks:processWebhookEvent',
			expect.objectContaining({
				token: 'convex_webhook_token',
				event: expect.objectContaining({ id: 'evt_2' }),
			}),
		);
	});
});
