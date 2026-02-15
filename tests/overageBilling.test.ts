import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Stripe mock ---
const mockInvoiceItemsCreate = vi.fn();
const mockInvoicesCreate = vi.fn();

vi.mock("../convex/stripe", () => ({
	stripe: {
		invoiceItems: { create: mockInvoiceItemsCreate },
		invoices: { create: mockInvoicesCreate },
	},
}));

// --- Convex server mocks ---
const runQueryMock = vi.fn();
const runMutationMock = vi.fn();

vi.mock("../convex/_generated/server", () => ({
	internalAction: (opts: { handler: Function }) => opts,
	internalQuery: (opts: { handler: Function }) => opts,
	internalMutation: (opts: { handler: Function }) => opts,
}));

vi.mock("../convex/_generated/api", () => ({
	internal: {
		usage: {
			getExpiredActiveCycles: "usage:getExpiredActiveCycles",
			completeBillingCycle: "usage:completeBillingCycle",
		},
		billing: {
			processOverageBilling: "billing:processOverageBilling",
		},
	},
}));

function createCtx() {
	return {
		runQuery: runQueryMock,
		runMutation: runMutationMock,
	};
}

function makeCycle(overrides: Record<string, unknown> = {}) {
	return {
		_id: "cycle_1",
		userId: "user_1",
		subscriptionId: "sub_1",
		periodStart: Date.now() - 30 * 24 * 60 * 60 * 1000,
		periodEnd: Date.now() - 1000,
		tokensUsed: 50000,
		tokenCost: 12.5,
		includedCredit: 10,
		overageAmount: 2.5,
		status: "active" as const,
		stripeCustomerId: "cus_test_123",
		...overrides,
	};
}

describe("processOverageBilling", () => {
	let handler: (ctx: ReturnType<typeof createCtx>) => Promise<{
		processed: number;
		invoiced: number;
		errors: number;
	}>;

	beforeEach(async () => {
		vi.clearAllMocks();
		vi.resetModules();
		mockInvoicesCreate.mockResolvedValue({ id: "inv_test_123" });
		mockInvoiceItemsCreate.mockResolvedValue({ id: "ii_test_123" });
		runMutationMock.mockResolvedValue(undefined);

		const mod = await import("../convex/billing");
		handler = (mod.processOverageBilling as any).handler;
	});

	it("creates an invoice for cycles with overage > $0.50", async () => {
		const cycle = makeCycle({ overageAmount: 2.5 });
		runQueryMock.mockResolvedValueOnce([cycle]);

		const result = await handler(createCtx());

		expect(result).toEqual({ processed: 1, invoiced: 1, errors: 0 });

		expect(mockInvoiceItemsCreate).toHaveBeenCalledOnce();
		expect(mockInvoiceItemsCreate).toHaveBeenCalledWith({
			customer: "cus_test_123",
			amount: 250, // $2.50 in cents
			currency: "usd",
			description: expect.stringContaining("Synapse token usage overage"),
		});

		expect(mockInvoicesCreate).toHaveBeenCalledOnce();
		expect(mockInvoicesCreate).toHaveBeenCalledWith({
			customer: "cus_test_123",
			collection_method: "charge_automatically",
			auto_advance: true,
			metadata: {
				billingCycleId: "cycle_1",
				type: "overage",
			},
		});

		expect(runMutationMock).toHaveBeenCalledWith(
			"usage:completeBillingCycle",
			{
				billingCycleId: "cycle_1",
				stripeInvoiceId: "inv_test_123",
			},
		);
	});

	it("skips invoice for cycles with zero overage", async () => {
		const cycle = makeCycle({ overageAmount: 0 });
		runQueryMock.mockResolvedValueOnce([cycle]);

		const result = await handler(createCtx());

		expect(result).toEqual({ processed: 1, invoiced: 0, errors: 0 });
		expect(mockInvoiceItemsCreate).not.toHaveBeenCalled();
		expect(mockInvoicesCreate).not.toHaveBeenCalled();
		expect(runMutationMock).toHaveBeenCalledWith(
			"usage:completeBillingCycle",
			{ billingCycleId: "cycle_1" },
		);
	});

	it("skips invoice for cycles with overage <= $0.50 threshold", async () => {
		const cycle = makeCycle({ overageAmount: 0.35 });
		runQueryMock.mockResolvedValueOnce([cycle]);

		const result = await handler(createCtx());

		expect(result).toEqual({ processed: 1, invoiced: 0, errors: 0 });
		expect(mockInvoiceItemsCreate).not.toHaveBeenCalled();
		expect(mockInvoicesCreate).not.toHaveBeenCalled();
		expect(runMutationMock).toHaveBeenCalledWith(
			"usage:completeBillingCycle",
			{ billingCycleId: "cycle_1" },
		);
	});

	it("returns early when no expired cycles exist", async () => {
		runQueryMock.mockResolvedValueOnce([]);

		const result = await handler(createCtx());

		expect(result).toEqual({ processed: 0, invoiced: 0, errors: 0 });
		expect(mockInvoiceItemsCreate).not.toHaveBeenCalled();
		expect(mockInvoicesCreate).not.toHaveBeenCalled();
		expect(runMutationMock).not.toHaveBeenCalled();
	});

	it("isolates errors: one cycle failure doesn't block others", async () => {
		const cycle1 = makeCycle({ _id: "cycle_1", overageAmount: 5.0 });
		const cycle2 = makeCycle({ _id: "cycle_2", overageAmount: 3.0 });
		runQueryMock.mockResolvedValueOnce([cycle1, cycle2]);

		// First cycle's invoice creation fails
		mockInvoiceItemsCreate
			.mockRejectedValueOnce(new Error("Stripe unavailable"))
			.mockResolvedValueOnce({ id: "ii_2" });
		mockInvoicesCreate.mockResolvedValueOnce({ id: "inv_2" });

		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		const result = await handler(createCtx());

		expect(result).toEqual({ processed: 2, invoiced: 1, errors: 1 });

		// Second cycle should still be processed
		expect(runMutationMock).toHaveBeenCalledWith(
			"usage:completeBillingCycle",
			{
				billingCycleId: "cycle_2",
				stripeInvoiceId: "inv_2",
			},
		);

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			expect.stringContaining("cycle_1"),
			expect.stringContaining("Stripe unavailable"),
		);

		consoleErrorSpy.mockRestore();
	});

	it("rounds overage amount to cents correctly", async () => {
		const cycle = makeCycle({ overageAmount: 1.999 });
		runQueryMock.mockResolvedValueOnce([cycle]);

		await handler(createCtx());

		expect(mockInvoiceItemsCreate).toHaveBeenCalledWith(
			expect.objectContaining({ amount: 200 }), // Math.round(1.999 * 100) = 200
		);
	});

	it("handles multiple cycles in a single run", async () => {
		const cycles = [
			makeCycle({ _id: "c1", overageAmount: 1.0 }),
			makeCycle({ _id: "c2", overageAmount: 0 }),
			makeCycle({ _id: "c3", overageAmount: 8.75 }),
		];
		runQueryMock.mockResolvedValueOnce(cycles);
		mockInvoicesCreate
			.mockResolvedValueOnce({ id: "inv_c1" })
			.mockResolvedValueOnce({ id: "inv_c3" });

		const result = await handler(createCtx());

		expect(result).toEqual({ processed: 3, invoiced: 2, errors: 0 });
		expect(mockInvoiceItemsCreate).toHaveBeenCalledTimes(2);
		expect(mockInvoicesCreate).toHaveBeenCalledTimes(2);
		expect(runMutationMock).toHaveBeenCalledTimes(3); // all 3 marked completed
	});
});
