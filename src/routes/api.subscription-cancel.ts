import { createFileRoute } from "@tanstack/react-router";
import { getBillingRouteContext } from "@/lib/server/billingRouteContext";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/api/subscription-cancel")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const billingContext = await getBillingRouteContext(request);
					if ("response" in billingContext) return billingContext.response;
					const { convexClient } = billingContext;

					const result = await convexClient.action(
						api.subscriptions.cancelSubscriptionAtPeriodEnd,
						{},
					);
					return new Response(JSON.stringify(result), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				} catch (error) {
					console.error("Error canceling subscription:", error);
					return new Response(
						JSON.stringify({
							error: "Failed to cancel subscription",
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
