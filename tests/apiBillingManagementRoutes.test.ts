import { beforeEach, describe, expect, it, vi } from 'vitest';

const mutationMock = vi.fn();
const actionMock = vi.fn();
const verifyTokenMock = vi.fn();

vi.mock('convex/browser', () => ({
	ConvexHttpClient: vi.fn(function ConvexHttpClientMock() {
		return {
			setAuth: vi.fn(),
			mutation: mutationMock,
			action: actionMock,
		};
	}),
}));

vi.mock('@clerk/backend', () => ({
	verifyToken: verifyTokenMock,
}));

vi.mock('@tanstack/react-router', () => ({
	createFileRoute: () => (options: unknown) => options,
}));

vi.mock('../convex/_generated/api', () => ({
	api: {
		subscriptions: {
			createBillingPortalSession: 'subscriptions:createBillingPortalSession',
			cancelSubscriptionAtPeriodEnd: 'subscriptions:cancelSubscriptionAtPeriodEnd',
			resumeSubscription: 'subscriptions:resumeSubscription',
			setMonthlySpendCap: 'subscriptions:setMonthlySpendCap',
		},
	},
}));

async function getPostHandler(routeFile: string) {
	vi.resetModules();
	(import.meta as any).env = {
		...import.meta.env,
		VITE_CONVEX_URL: 'https://convex.example.com',
	};
	process.env.CLERK_SECRET_KEY = 'sk_test_clerk';
	const mod = await import(routeFile);
	return (mod.Route as any).server.handlers.POST as (args: {
		request: Request;
	}) => Promise<Response>;
}

describe('Billing management API routes', () => {
	beforeEach(() => {
		mutationMock.mockReset();
		actionMock.mockReset();
		verifyTokenMock.mockReset();
	});

	it('billing portal returns 401 without auth', async () => {
		const post = await getPostHandler('../src/routes/api.billing-portal');
		const response = await post({
			request: new Request('http://localhost/api/billing-portal', {
				method: 'POST',
			}),
		});
		expect(response.status).toBe(401);
	});

	it('subscription spend cap route uses verified Clerk user id', async () => {
		verifyTokenMock.mockResolvedValueOnce({ sub: 'user_abc' });
		mutationMock.mockResolvedValueOnce({ success: true, monthlySpendCap: 75 });

		const post = await getPostHandler('../src/routes/api.subscription-spend-cap');
		const response = await post({
			request: new Request('http://localhost/api/subscription-spend-cap', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer token_1',
				},
				body: JSON.stringify({ monthlySpendCap: 75 }),
			}),
		});

		expect(response.status).toBe(200);
		expect(mutationMock).toHaveBeenCalledWith(
			'subscriptions:setMonthlySpendCap',
			{ monthlySpendCap: 75 },
		);
	});
});
