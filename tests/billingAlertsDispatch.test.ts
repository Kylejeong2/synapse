import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../convex/_generated/server', () => ({
	internalAction: (opts: { handler: Function }) => opts,
	internalMutation: (opts: { handler: Function }) => opts,
	internalQuery: (opts: { handler: Function }) => opts,
}));

vi.mock('../convex/_generated/api', () => ({
	internal: {
		billingAlerts: {
			listPendingBillingAlerts: 'billingAlerts:listPendingBillingAlerts',
			markBillingAlertNotified: 'billingAlerts:markBillingAlertNotified',
			markBillingAlertNotificationFailed: 'billingAlerts:markBillingAlertNotificationFailed',
		},
	},
}));

describe('billingAlerts.dispatchBillingAlerts', () => {
	beforeEach(() => {
		vi.resetModules();
		delete process.env.BILLING_ALERT_WEBHOOK_URL;
	});

	it('skips dispatch when webhook URL is not configured', async () => {
		const { dispatchBillingAlerts } = await import('../convex/billingAlerts');
		const result = await (dispatchBillingAlerts as any).handler(
			{ runQuery: vi.fn(), runMutation: vi.fn() },
			{},
		);
		expect(result).toEqual({ sent: 0, failed: 0, skipped: true });
	});

	it('marks alert as notified on successful webhook delivery', async () => {
		process.env.BILLING_ALERT_WEBHOOK_URL = 'https://example.com/alerts';
		const runQuery = vi.fn(async () => [
			{
				_id: 'alert_1',
				severity: 'warning',
				message: 'Invoice payment failed',
				context: '{}',
				createdAt: Date.now(),
			},
		]);
		const runMutation = vi.fn(async () => undefined);
		vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));

		const { dispatchBillingAlerts } = await import('../convex/billingAlerts');
		const result = await (dispatchBillingAlerts as any).handler(
			{ runQuery, runMutation },
			{},
		);

		expect(result).toEqual({ sent: 1, failed: 0, skipped: false });
		expect(runMutation).toHaveBeenCalledWith(
			'billingAlerts:markBillingAlertNotified',
			{ alertId: 'alert_1' },
		);
		vi.unstubAllGlobals();
	});

	it('records notification failure when webhook returns non-2xx', async () => {
		process.env.BILLING_ALERT_WEBHOOK_URL = 'https://example.com/alerts';
		const runQuery = vi.fn(async () => [
			{
				_id: 'alert_2',
				severity: 'error',
				message: 'Webhook processing failed',
				context: '{}',
				createdAt: Date.now(),
			},
		]);
		const runMutation = vi.fn(async () => undefined);
		vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));

		const { dispatchBillingAlerts } = await import('../convex/billingAlerts');
		const result = await (dispatchBillingAlerts as any).handler(
			{ runQuery, runMutation },
			{},
		);

		expect(result).toEqual({ sent: 0, failed: 1, skipped: false });
		expect(runMutation).toHaveBeenCalledWith(
			'billingAlerts:markBillingAlertNotificationFailed',
			expect.objectContaining({ alertId: 'alert_2' }),
		);
		vi.unstubAllGlobals();
	});
});
