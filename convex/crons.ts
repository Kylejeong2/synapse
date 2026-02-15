import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval(
	'process overage billing',
	{ hours: 1 },
	internal.billing.processOverageBilling,
);

export default crons;
