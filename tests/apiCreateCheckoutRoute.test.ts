import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mutationMock = vi.fn();
const verifyTokenMock = vi.fn();

vi.mock("convex/browser", () => ({
	ConvexHttpClient: vi.fn(function ConvexHttpClientMock() {
		return {
			mutation: mutationMock,
		};
	}),
}));

vi.mock("@clerk/backend", () => ({
	verifyToken: verifyTokenMock,
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
	process.env.CLERK_SECRET_KEY = "sk_test_clerk";
	const mod = await import("../src/routes/api.create-checkout");
	return (mod.Route as any).server.handlers.POST as (args: {
		request: Request;
	}) => Promise<Response>;
}

describe("POST /api/create-checkout", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		mutationMock.mockReset();
		verifyTokenMock.mockReset();
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	it("returns 401 when authorization header is missing", async () => {
		const post = await getPostHandler();
		const response = await post({
			request: new Request("http://localhost/api/create-checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userEmail: "test@example.com" }),
			}),
		});

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: "Unauthorized",
		});
		expect(verifyTokenMock).not.toHaveBeenCalled();
		expect(mutationMock).not.toHaveBeenCalled();
	});

	it("returns 401 when token verification fails", async () => {
		verifyTokenMock.mockRejectedValueOnce(new Error("invalid token"));
		const post = await getPostHandler();
		const response = await post({
			request: new Request("http://localhost/api/create-checkout", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer bad_token",
				},
				body: JSON.stringify({ userEmail: "test@example.com" }),
			}),
		});

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: "Unauthorized",
		});
		expect(mutationMock).not.toHaveBeenCalled();
	});

	it("returns checkout URL on success with verified Clerk user", async () => {
		verifyTokenMock.mockResolvedValueOnce({ sub: "user_123" });
		mutationMock.mockResolvedValueOnce({ url: "https://checkout.stripe.com/c/test" });
		const post = await getPostHandler();
		const response = await post({
			request: new Request("http://localhost/api/create-checkout", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer token_123",
				},
				body: JSON.stringify({
					userId: "ignored_client_user",
					userEmail: "user@example.com",
				}),
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			url: "https://checkout.stripe.com/c/test",
		});
		expect(verifyTokenMock).toHaveBeenCalledWith("token_123", {
			secretKey: "sk_test_clerk",
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
		verifyTokenMock.mockResolvedValueOnce({ sub: "user_123" });
		mutationMock.mockResolvedValueOnce({ url: null });
		const post = await getPostHandler();
		const response = await post({
			request: new Request("http://localhost/api/create-checkout", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer token_123",
				},
				body: JSON.stringify({ userEmail: "user@example.com" }),
			}),
		});

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			error: "Failed to create checkout session",
		});
	});
});
