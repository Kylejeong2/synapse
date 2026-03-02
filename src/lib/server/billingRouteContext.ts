import { ConvexHttpClient } from "convex/browser";
import { requireClerkUserId } from "./clerkAuth";

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

export async function getBillingRouteContext(
	request: Request,
): Promise<
	{ response: Response } | { userId: string; convexClient: ConvexHttpClient }
> {
	const auth = await requireClerkUserId(request);
	if ("response" in auth) {
		return { response: auth.response };
	}

	const token = getBearerToken(request);
	if (!token) {
		return {
			response: new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			}),
		};
	}

	const convexClient = new ConvexHttpClient(CONVEX_URL);
	convexClient.setAuth(token);
	return { userId: auth.userId, convexClient };
}
