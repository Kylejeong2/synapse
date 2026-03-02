type UpsertBillingCustomerArgs = {
	userId: string;
	stripeCustomerId: string;
	email?: string;
};

export async function upsertBillingCustomerByUserId(
	ctx: any,
	args: UpsertBillingCustomerArgs,
): Promise<'inserted' | 'updated'> {
	const existingByUser = await ctx.db
		.query('billing_customers')
		.withIndex('userId', (q: any) => q.eq('userId', args.userId))
		.first();

	if (existingByUser) {
		await ctx.db.patch(existingByUser._id, {
			stripeCustomerId: args.stripeCustomerId,
			email: args.email,
			updatedAt: Date.now(),
		});
		return 'updated';
	}

	await ctx.db.insert('billing_customers', {
		userId: args.userId,
		stripeCustomerId: args.stripeCustomerId,
		email: args.email,
		updatedAt: Date.now(),
	});
	return 'inserted';
}
