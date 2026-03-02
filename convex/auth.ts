export async function requireAuthenticatedUserId(ctx: {
	auth: { getUserIdentity: () => Promise<{ subject?: string } | null> };
}): Promise<string> {
	const identity = await ctx.auth.getUserIdentity();
	const userId = identity?.subject;
	if (!userId) {
		throw new Error("Unauthorized");
	}
	return userId;
}
