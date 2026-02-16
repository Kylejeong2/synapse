import { verifyToken } from "@clerk/backend";

function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} environment variable is not set`);
	}
	return value;
}

export async function requireClerkUserId(
	request: Request,
): Promise<{ userId: string } | { response: Response }> {
	const authHeader = request.headers.get("authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return {
			response: new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			}),
		};
	}

	const token = authHeader.slice("Bearer ".length).trim();
	if (!token) {
		return {
			response: new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			}),
		};
	}

	let claims: Awaited<ReturnType<typeof verifyToken>>;
	try {
		claims = await verifyToken(token, {
			secretKey: getRequiredEnv("CLERK_SECRET_KEY"),
		});
	} catch {
		return {
			response: new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			}),
		};
	}

	const userId = claims.sub;
	if (!userId) {
		return {
			response: new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			}),
		};
	}

	return { userId };
}
