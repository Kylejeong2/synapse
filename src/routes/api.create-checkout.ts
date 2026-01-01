import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "";
if (!CONVEX_URL) {
	throw new Error("VITE_CONVEX_URL environment variable is not set");
}
const convexClient = new ConvexHttpClient(CONVEX_URL);

export const Route = createFileRoute("/api/create-checkout")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const body = await request.json();
					const { userId, userEmail } = body;

					if (!userId) {
						return new Response(
							JSON.stringify({ error: "User ID is required" }),
							{
								status: 400,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

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
