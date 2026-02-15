import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (options: unknown) => options,
}));

type FetchCall = {
	input: RequestInfo | URL;
	init?: RequestInit;
};

async function getPostHandler(convexUrl: string) {
	vi.resetModules();
	(import.meta as any).env = {
		...import.meta.env,
		VITE_CONVEX_URL: convexUrl,
	};
	const mod = await import("../src/routes/api.create-checkout");
	return (mod.Route as any).server.handlers.POST as (args: {
		request: Request;
	}) => Promise<Response>;
}

describe("POST /api/create-checkout (black-box + real ConvexHttpClient)", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
	let fetchCalls: FetchCall[] = [];

	beforeEach(() => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		fetchCalls = [];
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		vi.unstubAllGlobals();
	});

	it("sends Convex mutation request and returns URL", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				fetchCalls.push({ input, init });
				return new Response(
					JSON.stringify({
						status: "success",
						value: { url: "https://checkout.stripe.com/cs_test_blackbox" },
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}),
		);

		const post = await getPostHandler("https://convex.blackbox.test");
		const response = await post({
			request: new Request("http://localhost/api/create-checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: "user_blackbox",
					userEmail: "blackbox@example.com",
				}),
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			url: "https://checkout.stripe.com/cs_test_blackbox",
		});

		expect(fetchCalls).toHaveLength(1);
		expect(String(fetchCalls[0].input)).toMatch(/\/api\/mutation$/);
		expect(fetchCalls[0].init?.method).toBe("POST");

		const requestBody = JSON.parse(fetchCalls[0].init?.body as string);
		expect(requestBody).toEqual(
			expect.objectContaining({
				path: expect.any(String),
				format: "convex_encoded_json",
				args: [
					{
						userId: "user_blackbox",
						userEmail: "blackbox@example.com",
					},
				],
			}),
		);
	});

	it("maps Convex/UDF errors to 500 responses with details", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				return new Response(
					JSON.stringify({
						status: "error",
						errorMessage: "Upstream checkout failed",
					}),
					{
						status: 560,
						headers: { "Content-Type": "application/json" },
					},
				);
			}),
		);

		const post = await getPostHandler("https://convex.blackbox.test");
		const response = await post({
			request: new Request("http://localhost/api/create-checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: "user_fail" }),
			}),
		});

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			error: "Failed to create checkout session",
			details: "Upstream checkout failed",
		});
	});
});
