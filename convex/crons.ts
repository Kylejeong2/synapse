import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

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
	(internal as any).billingAlerts.dispatchBillingAlerts,
	{ limit: 25 },
);

crons.interval(
	'process pending usage metering jobs',
	{ minutes: 5 },
	(internal as any).usage.processPendingUsageMeteringJobs,
	{ limit: 50 },
);

export default crons;
