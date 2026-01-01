import { cronJobs } from 'convex/server';
import { api } from './_generated/api';

const crons = cronJobs();

// Clean up old usage records (older than 90 days) weekly on Sunday at 3 AM UTC
crons.weekly(
	'cleanupOldUsageRecords',
	{
		dayOfWeek: 'sunday',
		hourUTC: 3,
		minuteUTC: 0,
	},
	api.billing.cleanupOldUsageRecords,
	{},
);

export default crons;

