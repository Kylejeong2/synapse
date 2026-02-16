import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../convex/_generated/server', () => ({
	mutation: (opts: { handler: Function }) => opts,
}));

function buildQueryResult(firstValue: unknown) {
	return {
		withIndex: () => ({
			first: vi.fn(async () => firstValue),
		}),
	};
}

describe('convex/stripeWebhooks', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('registerWebhookEvent stores a new Stripe event id', async () => {
		const insert = vi.fn(async () => 'evt_doc_1');
		const db = {
			query: vi.fn(() => buildQueryResult(null)),
			insert,
		};

		const { registerWebhookEvent } = await import('../convex/stripeWebhooks');
		const result = await (registerWebhookEvent as any).handler({ db }, {
			eventId: 'evt_1',
			type: 'checkout.session.completed',
			createdAt: 1_700_000_000_000,
		});

		expect(result).toEqual({ accepted: true });
		expect(insert).toHaveBeenCalledWith(
			'stripe_events',
			expect.objectContaining({
				eventId: 'evt_1',
				type: 'checkout.session.completed',
				createdAt: 1_700_000_000_000,
			}),
		);
	});

	it('registerWebhookEvent ignores duplicate event ids', async () => {
		const insert = vi.fn();
		const db = {
			query: vi.fn(() => buildQueryResult({ _id: 'evt_doc_1', eventId: 'evt_1' })),
			insert,
		};

		const { registerWebhookEvent } = await import('../convex/stripeWebhooks');
		const result = await (registerWebhookEvent as any).handler({ db }, {
			eventId: 'evt_1',
			type: 'customer.subscription.updated',
			createdAt: 1_700_000_000_000,
		});

		expect(result).toEqual({ accepted: false });
		expect(insert).not.toHaveBeenCalled();
	});

	it('upsertSubscriptionFromStripe inserts when no record exists', async () => {
		const insert = vi.fn(async () => 'sub_doc_1');
		const query = vi
			.fn()
			.mockImplementationOnce(() => buildQueryResult(null))
			.mockImplementationOnce(() => buildQueryResult(null));
		const db = { query, insert, patch: vi.fn() };

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
				stripeCustomerId: 'cus_1',
				stripeSubscriptionId: 'sub_1',
				status: 'active',
				includedTokenCredit: 10,
			}),
		);
	});

	it('upsertSubscriptionFromStripe updates existing record by subscription id', async () => {
		const patch = vi.fn(async () => undefined);
		const query = vi
			.fn()
			.mockImplementationOnce(() => buildQueryResult({ _id: 'sub_doc_existing' }))
			.mockImplementationOnce(() => buildQueryResult(null));
		const db = { query, patch, insert: vi.fn() };

		const { upsertSubscriptionFromStripe } = await import('../convex/stripeWebhooks');
		const result = await (upsertSubscriptionFromStripe as any).handler({ db }, {
			userId: 'user_2',
			stripeCustomerId: 'cus_2',
			stripeSubscriptionId: 'sub_2',
			status: 'past_due',
			currentPeriodStart: 10,
			currentPeriodEnd: 20,
			includedTokenCredit: 15,
		});

		expect(result).toEqual({ action: 'updated_by_subscription' });
		expect(patch).toHaveBeenCalledWith(
			'sub_doc_existing',
			expect.objectContaining({
				status: 'past_due',
				includedTokenCredit: 15,
			}),
		);
	});
});
