import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { requireClerkUserId } from "../lib/server/clerkAuth";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "";
if (!CONVEX_URL) {
	throw new Error("VITE_CONVEX_URL environment variable is not set");
}

const convexClient = new ConvexHttpClient(CONVEX_URL);

export const Route = createFileRoute("/api/subscription-resume")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const auth = await requireClerkUserId(request);
					if ("response" in auth) return auth.response;

					const result = await convexClient.mutation(
						api.subscriptions.resumeSubscription,
						{ userId: auth.userId },
					);
					return new Response(JSON.stringify(result), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				} catch (error) {
					return new Response(
						JSON.stringify({
							error: "Failed to resume subscription",
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
