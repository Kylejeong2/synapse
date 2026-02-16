import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval(
	'process overage billing',
	{ hours: 1 },
	internal.billing.processOverageBilling,
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

export default crons;
