import { verifyToken } from "@clerk/backend";
import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "";
if (!CONVEX_URL) {
	throw new Error("VITE_CONVEX_URL environment variable is not set");
}
const convexClient = new ConvexHttpClient(CONVEX_URL);

function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} environment variable is not set`);
	}
	return value;
}

export const Route = createFileRoute("/api/create-checkout")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const authHeader = request.headers.get("authorization");
					if (!authHeader || !authHeader.startsWith("Bearer ")) {
						return new Response(JSON.stringify({ error: "Unauthorized" }), {
							status: 401,
							headers: { "Content-Type": "application/json" },
						});
					}

					const token = authHeader.slice("Bearer ".length).trim();
					if (!token) {
						return new Response(JSON.stringify({ error: "Unauthorized" }), {
							status: 401,
							headers: { "Content-Type": "application/json" },
						});
					}

					let claims: Awaited<ReturnType<typeof verifyToken>>;
					try {
						claims = await verifyToken(token, {
							secretKey: getRequiredEnv("CLERK_SECRET_KEY"),
						});
					} catch {
						return new Response(JSON.stringify({ error: "Unauthorized" }), {
							status: 401,
							headers: { "Content-Type": "application/json" },
						});
					}
					const userId = claims.sub;
					if (!userId) {
						return new Response(JSON.stringify({ error: "Unauthorized" }), {
							status: 401,
							headers: { "Content-Type": "application/json" },
						});
					}

					const body = await request.json();
					const { userEmail } = body;

					const result = await convexClient.mutation(
						api.subscriptions.createCheckoutSession,
						{
							userId,
							userEmail,
						},
					);

					if (!result.url) {
						return new Response(
							JSON.stringify({ error: "Failed to create checkout session" }),
							{
								status: 500,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					return new Response(JSON.stringify({ url: result.url }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				} catch (error) {
					console.error("Error creating checkout session:", error);
					return new Response(
						JSON.stringify({
							error: "Failed to create checkout session",
							details: error instanceof Error ? error.message : String(error),
						}),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			},
		},
	},
});
