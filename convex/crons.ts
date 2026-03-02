import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

// NOTE: Some references use `(internal as any)` because the generated types
// in _generated/api.d.ts are stale. These casts resolve after `npx convex dev`.
const i = internal as any;

const crons = cronJobs();

crons.interval(
	'ensure default token pricing seeded',
	{ hours: 1 },
	i.tokenPricing.ensureDefaultPricingSeeded,
);

crons.interval(
	'process overage billing',
	{ hours: 1 },
	internal.billing.processOverageBilling,
);

crons.interval(
	'reconcile pending overage billing',
	{ minutes: 30 },
	internal.billing.reconcilePendingOverageBilling,
);

crons.interval(
	'retry failed stripe webhooks',
	{ minutes: 10 },
	internal.stripeWebhooks.retryFailedWebhookEvents,
	{ limit: 25 },
);

crons.interval(
	'dispatch billing alerts',
	{ minutes: 5 },
	i.billingAlerts.dispatchBillingAlerts,
	{ limit: 25 },
);

crons.interval(
	'process pending usage metering jobs',
	{ minutes: 5 },
	i.usage.processPendingUsageMeteringJobs,
	{ limit: 50 },
);

crons.interval(
	'reconcile duplicate active billing cycles',
	{ hours: 6 },
	i.usage.reconcileDuplicateActiveBillingCycles,
	{ limit: 500 },
);

export default crons;
