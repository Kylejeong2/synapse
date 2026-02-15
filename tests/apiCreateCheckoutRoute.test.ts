import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mutationMock = vi.fn();

vi.mock("convex/browser", () => ({
	ConvexHttpClient: vi.fn().mockImplementation(() => ({
		mutation: mutationMock,
	})),
}));

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: unknown) => options,
}));

vi.mock("../convex/_generated/api", () => ({
	api: {
		subscriptions: {
			createCheckoutSession: "subscriptions:createCheckoutSession",
		},
	},
}));

async function getPostHandler() {
	vi.resetModules();
	(import.meta as any).env = {
		...import.meta.env,
		VITE_CONVEX_URL: "https://convex.example.com",
	};
	const mod = await import("../src/routes/api.create-checkout");
	return (mod.Route as any).server.handlers.POST as (args: {
		request: Request;
	}) => Promise<Response>;
}

describe("POST /api/create-checkout", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		mutationMock.mockReset();
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	it("returns 400 when userId is missing", async () => {
		const post = await getPostHandler();
		const response = await post({
			request: new Request("http://localhost/api/create-checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userEmail: "test@example.com" }),
			}),
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: "User ID is required",
		});
		expect(mutationMock).not.toHaveBeenCalled();
	});

	it("returns checkout URL on success", async () => {
		mutationMock.mockResolvedValueOnce({ url: "https://checkout.stripe.com/c/test" });
		const post = await getPostHandler();
		const response = await post({
			request: new Request("http://localhost/api/create-checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: "user_123",
					userEmail: "user@example.com",
				}),
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			url: "https://checkout.stripe.com/c/test",
		});
		expect(mutationMock).toHaveBeenCalledWith(
			"subscriptions:createCheckoutSession",
			{
				userId: "user_123",
				userEmail: "user@example.com",
			},
		);
	});

	it("returns 500 when mutation succeeds without URL", async () => {
		mutationMock.mockResolvedValueOnce({ url: null });
		const post = await getPostHandler();
		const response = await post({
			request: new Request("http://localhost/api/create-checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: "user_123" }),
			}),
		});

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			error: "Failed to create checkout session",
		});
	});

	it("returns 500 with error details when mutation throws", async () => {
		mutationMock.mockRejectedValueOnce(new Error("convex down"));
		const post = await getPostHandler();
		const response = await post({
			request: new Request("http://localhost/api/create-checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: "user_123" }),
			}),
		});

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			error: "Failed to create checkout session",
			details: "convex down",
		});
	});
});
