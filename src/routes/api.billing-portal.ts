import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { requireClerkUserId } from "../lib/server/clerkAuth";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "";
if (!CONVEX_URL) {
	throw new Error("VITE_CONVEX_URL environment variable is not set");
}

function getBearerToken(request: Request): string | null {
	const authHeader = request.headers.get("authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return null;
	}
	const token = authHeader.slice("Bearer ".length).trim();
	return token || null;
}

export const Route = createFileRoute("/api/billing-portal")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const auth = await requireClerkUserId(request);
					if ("response" in auth) return auth.response;
					const token = getBearerToken(request);
					if (!token) {
						return new Response(JSON.stringify({ error: "Unauthorized" }), {
							status: 401,
							headers: { "Content-Type": "application/json" },
						});
					}
					const convexClient = new ConvexHttpClient(CONVEX_URL);
					convexClient.setAuth(token);

					const result = await convexClient.mutation(
						api.subscriptions.createBillingPortalSession,
						{},
					);

					if (!result.url) {
						return new Response(
							JSON.stringify({ error: "Failed to create portal session" }),
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
					return new Response(
						JSON.stringify({
							error: "Failed to create portal session",
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
