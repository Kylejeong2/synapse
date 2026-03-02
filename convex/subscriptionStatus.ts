export const BILLING_ENTITLED_SUBSCRIPTION_STATUSES = [
	'active',
	'trialing',
] as const;

export const OPEN_BILLING_SUBSCRIPTION_STATUSES = [
	'active',
	'trialing',
	'past_due',
	'unpaid',
	'incomplete',
] as const;

export function isBillingEntitledSubscriptionStatus(status: string): boolean {
	return (
		BILLING_ENTITLED_SUBSCRIPTION_STATUSES as readonly string[]
	).includes(status);
}

export function isOpenBillingSubscriptionStatus(status: string): boolean {
	return (
		OPEN_BILLING_SUBSCRIPTION_STATUSES as readonly string[]
	).includes(status);
}
