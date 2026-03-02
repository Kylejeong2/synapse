import { beforeEach, describe, expect, it, vi } from 'vitest';

const mutationMock = vi.fn();
const actionMock = vi.fn();
const eventsRetrieveMock = vi.fn();

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
				events: { retrieve: eventsRetrieveMock },
				subscriptions: { retrieve: vi.fn() },
			};
		}),
	};
});

async function getReplayHandler() {
	vi.resetModules();
	(import.meta as any).env = {
		...import.meta.env,
		VITE_CONVEX_URL: 'https://convex.example.com',
	};
	process.env.STRIPE_SECRET_KEY = 'sk_test_123';
	process.env.STRIPE_WEBHOOK_REPLAY_TOKEN = 'replay_secret';
	process.env.STRIPE_WEBHOOK_CONVEX_TOKEN = 'convex_webhook_token';
	const mod = await import('../src/routes/api.stripe-webhook.replay');
	return (mod.Route as any).server.handlers.POST as (args: {
		request: Request;
	}) => Promise<Response>;
}

describe('POST /api/stripe-webhook/replay', () => {
	beforeEach(() => {
		mutationMock.mockReset();
		actionMock.mockReset();
		eventsRetrieveMock.mockReset();
	});

	it('returns 401 for missing replay token header', async () => {
		const post = await getReplayHandler();
		const response = await post({
			request: new Request('http://localhost/api/stripe-webhook/replay', {
				method: 'POST',
				body: JSON.stringify({ eventId: 'evt_1' }),
			}),
		});

		expect(response.status).toBe(401);
	});

	it('replays a Stripe event by id', async () => {
		eventsRetrieveMock.mockResolvedValueOnce({
			id: 'evt_2',
			type: 'invoice.finalized',
			created: 1,
			data: { object: { subscription: 'sub_1', customer: 'cus_1' } },
		});
		actionMock.mockResolvedValueOnce({ duplicate: false });

		const post = await getReplayHandler();
		const response = await post({
			request: new Request('http://localhost/api/stripe-webhook/replay', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-webhook-replay-token': 'replay_secret',
				},
				body: JSON.stringify({ eventId: 'evt_2' }),
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			replayed: true,
			duplicate: false,
		});
		expect(actionMock).toHaveBeenCalledWith(
			'stripeWebhooks:processWebhookEvent',
			expect.objectContaining({
				token: 'convex_webhook_token',
				event: expect.objectContaining({ id: 'evt_2' }),
			}),
		);
	});

	it('returns 403 when replay IP allowlist is configured and request IP is not allowed', async () => {
		process.env.STRIPE_WEBHOOK_REPLAY_ALLOWED_IPS = '1.2.3.4';
		const post = await getReplayHandler();
		const response = await post({
			request: new Request('http://localhost/api/stripe-webhook/replay', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-webhook-replay-token': 'replay_secret',
					'x-forwarded-for': '5.6.7.8',
				},
				body: JSON.stringify({ eventId: 'evt_2' }),
			}),
		});

		expect(response.status).toBe(403);
		delete process.env.STRIPE_WEBHOOK_REPLAY_ALLOWED_IPS;
	});
});
