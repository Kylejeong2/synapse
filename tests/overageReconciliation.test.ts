import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInvoicesList = vi.fn();

vi.mock('../convex/stripe', () => ({
	stripe: {
		invoices: { list: mockInvoicesList },
	},
}));

vi.mock('../convex/_generated/server', () => ({
	internalAction: (opts: { handler: Function }) => opts,
	internalQuery: (opts: { handler: Function }) => opts,
	internalMutation: (opts: { handler: Function }) => opts,
}));

vi.mock('../convex/_generated/api', () => ({
	internal: {
		usage: {
			getPendingCycles: 'usage:getPendingCycles',
			completeBillingCycle: 'usage:completeBillingCycle',
			setBillingCycleStatus: 'usage:setBillingCycleStatus',
		},
		billing: {
			logBillingAlert: 'billing:logBillingAlert',
		},
	},
}));

describe('billing.reconcilePendingOverageBilling', () => {
	beforeEach(() => {
		vi.resetModules();
		mockInvoicesList.mockReset();
	});

	it('completes pending cycle when Stripe invoice metadata matches billing cycle id', async () => {
		const runQuery = vi.fn(async () => [
			{ _id: 'cycle_1', stripeCustomerId: 'cus_1' },
		]);
		const runMutation = vi.fn(async () => undefined);
		mockInvoicesList.mockResolvedValueOnce({
			data: [{ id: 'inv_1', metadata: { billingCycleId: 'cycle_1' } }],
		});

		const { reconcilePendingOverageBilling } = await import('../convex/billing');
		const result = await (reconcilePendingOverageBilling as any).handler(
			{ runQuery, runMutation },
		);

		expect(result).toEqual({
			scanned: 1,
			completed: 1,
			resetToActive: 0,
			errors: 0,
		});
		expect(runMutation).toHaveBeenCalledWith('usage:completeBillingCycle', {
			billingCycleId: 'cycle_1',
			stripeInvoiceId: 'inv_1',
		});
	});

	it('resets pending cycle to active when no matching Stripe invoice exists', async () => {
		const runQuery = vi.fn(async () => [
			{ _id: 'cycle_2', stripeCustomerId: 'cus_2' },
		]);
		const runMutation = vi.fn(async () => undefined);
		mockInvoicesList.mockResolvedValueOnce({
			data: [{ id: 'inv_other', metadata: { billingCycleId: 'other_cycle' } }],
		});

		const { reconcilePendingOverageBilling } = await import('../convex/billing');
		const result = await (reconcilePendingOverageBilling as any).handler(
			{ runQuery, runMutation },
		);

		expect(result).toEqual({
			scanned: 1,
			completed: 0,
			resetToActive: 1,
			errors: 0,
		});
		expect(runMutation).toHaveBeenCalledWith('usage:setBillingCycleStatus', {
			billingCycleId: 'cycle_2',
			status: 'active',
		});
	});
});
