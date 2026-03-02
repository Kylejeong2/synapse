import { createFileRoute } from "@tanstack/react-router";
import { getBillingRouteContext } from "@/lib/server/billingRouteContext";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/api/billing-portal")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const billingContext = await getBillingRouteContext(request);
					if ("response" in billingContext) return billingContext.response;
					const { convexClient } = billingContext;

					const result = await convexClient.action(
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
					console.error("Error creating portal session:", error);
					return new Response(
						JSON.stringify({
							error: "Failed to create portal session",
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
