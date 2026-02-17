import { internal } from './_generated/api';
import {
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	query,
} from './_generated/server';
import { v } from 'convex/values';
import { isBillingEntitledSubscriptionStatus } from './subscriptionStatus';
import { requireAuthenticatedUserId } from './auth';

const MAX_METERING_RETRIES = 8;
const BASE_METERING_RETRY_MS = 60_000;

const meteringPayloadArgs = {
	conversationId: v.id('conversations'),
	nodeId: v.id('nodes'),
	model: v.string(),
	tokensUsed: v.number(),
	inputTokens: v.optional(v.number()),
	outputTokens: v.optional(v.number()),
	thinkingTokens: v.optional(v.number()),
	tokenCost: v.optional(v.number()),
};

type MeteringPayload = {
	conversationId: any;
	nodeId: any;
	model: string;
	tokensUsed: number;
	inputTokens?: number;
	outputTokens?: number;
	thinkingTokens?: number;
	tokenCost?: number;
};

async function assertConversationAndNodeOwnership(
	ctx: any,
	args: MeteringPayload,
	userId: string,
) {
	const conversation = await ctx.db.get(args.conversationId);
	if (!conversation) {
		throw new Error('Conversation not found');
	}
	if (conversation.userId !== userId) {
		throw new Error('Forbidden');
	}
	const node = await ctx.db.get(args.nodeId);
	if (!node || node.conversationId !== args.conversationId) {
		throw new Error('Node not found');
	}
}

async function getEffectiveTokenCost(
	ctx: any,
	args: MeteringPayload,
): Promise<number> {
	const inputTokens = args.inputTokens ?? 0;
	const outputTokens = args.outputTokens ?? 0;
	const thinkingTokens = args.thinkingTokens ?? 0;

	const pricing = await ctx.db
		.query('token_pricing')
		.withIndex('model', (q: any) => q.eq('model', args.model))
		.filter((q: any) => q.eq(q.field('isActive'), true))
		.first();

	const effectiveTokenCost = pricing
		? inputTokens * pricing.pricePerTokenInput +
			outputTokens * pricing.pricePerTokenOutput +
			thinkingTokens * (pricing.pricePerTokenThinking ?? pricing.pricePerTokenOutput)
		: args.tokenCost;

	if (effectiveTokenCost === undefined) {
		throw new Error(
			`Cannot determine token cost for model '${args.model}'. Add active token_pricing data or pass tokenCost.`,
		);
	}

	return effectiveTokenCost;
}

async function getOrCreateCurrentBillingCycle(
	ctx: any,
	args: {
		userId: string;
		subscription: any;
	},
) {
	const matches = await ctx.db
		.query('billing_cycles')
		.withIndex('subscriptionPeriod', (q: any) =>
			q
				.eq('subscriptionId', args.subscription._id)
				.eq('periodStart', args.subscription.currentPeriodStart)
				.eq('periodEnd', args.subscription.currentPeriodEnd),
		)
		.filter((q: any) => q.eq(q.field('status'), 'active'))
		.collect();

	if (matches.length === 0) {
		const billingCycleId = await ctx.db.insert('billing_cycles', {
			userId: args.userId,
			subscriptionId: args.subscription._id,
			periodStart: args.subscription.currentPeriodStart,
			periodEnd: args.subscription.currentPeriodEnd,
			tokensUsed: 0,
			tokenCost: 0,
			includedCredit: args.subscription.includedTokenCredit,
			overageAmount: 0,
			status: 'active',
		});
		const inserted = await ctx.db.get(billingCycleId);
		if (inserted) return inserted;
		return {
			_id: billingCycleId,
			userId: args.userId,
			subscriptionId: args.subscription._id,
			periodStart: args.subscription.currentPeriodStart,
			periodEnd: args.subscription.currentPeriodEnd,
			tokensUsed: 0,
			tokenCost: 0,
			includedCredit: args.subscription.includedTokenCredit,
			overageAmount: 0,
			status: 'active',
		};
	}

	const sorted = [...matches].sort(
		(a, b) => (a._creationTime ?? 0) - (b._creationTime ?? 0),
	);
	const canonical = sorted[0];
	const duplicates = sorted.slice(1);

	if (duplicates.length > 0) {
		let mergedTokens = 0;
		let mergedCost = 0;
		for (const cycle of sorted) {
			mergedTokens += cycle.tokensUsed;
			mergedCost += cycle.tokenCost;
		}

		await ctx.db.patch(canonical._id, {
			tokensUsed: mergedTokens,
			tokenCost: mergedCost,
			overageAmount: Math.max(0, mergedCost - canonical.includedCredit),
		});

		for (const duplicate of duplicates) {
			const duplicateRecords = await ctx.db
				.query('usage_records')
				.withIndex('billingCycleId', (q: any) =>
					q.eq('billingCycleId', duplicate._id),
				)
				.collect();
			for (const record of duplicateRecords) {
				await ctx.db.patch(record._id, {
					billingCycleId: canonical._id,
				});
			}
			await ctx.db.patch(duplicate._id, {
				status: 'completed',
			});
		}

		return {
			...canonical,
			tokensUsed: mergedTokens,
			tokenCost: mergedCost,
			overageAmount: Math.max(0, mergedCost - canonical.includedCredit),
		};
	}

	return canonical;
}

async function recordUsageForUser(
	ctx: any,
	userId: string,
	args: MeteringPayload,
): Promise<{ success: true; duplicate: boolean }> {
	const existingUsage = await ctx.db
		.query('usage_records')
		.withIndex('nodeId', (q: any) => q.eq('nodeId', args.nodeId))
		.first();
	if (existingUsage) {
		return { success: true, duplicate: true };
	}

	const timestamp = Date.now();
	const effectiveTokenCost = await getEffectiveTokenCost(ctx, args);

	const subscription = await ctx.db
		.query('subscriptions')
		.withIndex('userId', (q: any) => q.eq('userId', userId))
		.first();
	const entitledSubscription =
		subscription && isBillingEntitledSubscriptionStatus(subscription.status)
			? subscription
			: null;

	let billingCycleId: string | undefined;

	if (entitledSubscription) {
		const billingCycle = await getOrCreateCurrentBillingCycle(ctx, {
			userId,
			subscription: entitledSubscription,
		});
		if (!billingCycle) {
			throw new Error('Failed to resolve billing cycle');
		}

		const nextTokenCost = billingCycle.tokenCost + effectiveTokenCost;
		await ctx.db.patch(billingCycle._id, {
			tokensUsed: billingCycle.tokensUsed + args.tokensUsed,
			tokenCost: nextTokenCost,
			overageAmount: Math.max(0, nextTokenCost - billingCycle.includedCredit),
		});
		billingCycleId = billingCycle._id;
	} else {
		const freeTierUsage = await ctx.db
			.query('free_tier_usage')
			.withIndex('conversationId', (q: any) =>
				q.eq('conversationId', args.conversationId),
			)
			.first();

		if (freeTierUsage) {
			await ctx.db.patch(freeTierUsage._id, {
				tokensUsed: freeTierUsage.tokensUsed + args.tokensUsed,
			});
		} else {
			await ctx.db.insert('free_tier_usage', {
				userId,
				conversationId: args.conversationId,
				tokensUsed: args.tokensUsed,
				createdAt: timestamp,
				isLocked: true,
			});
		}
	}

	await ctx.db.insert('usage_records', {
		userId,
		conversationId: args.conversationId,
		nodeId: args.nodeId,
		model: args.model,
		tokensUsed: args.tokensUsed,
		tokenCost: effectiveTokenCost,
		timestamp,
		billingCycleId: billingCycleId as any,
	});

	return { success: true, duplicate: false };
}

/**
 * Record token usage for a request
 */
export const recordUsage = mutation({
	args: meteringPayloadArgs,
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		await assertConversationAndNodeOwnership(ctx, args, userId);
		return await recordUsageForUser(ctx, userId, args);
	},
});

/**
 * Best-effort queue write used when synchronous usage metering fails in the request path.
 */
export const enqueueUsageMeteringJob = mutation({
	args: {
		...meteringPayloadArgs,
		failureReason: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		await assertConversationAndNodeOwnership(ctx, args, userId);

		const now = Date.now();
		const existing = await ctx.db
			.query('usage_metering_jobs')
			.withIndex('nodeId', (q) => q.eq('nodeId', args.nodeId))
			.first();

		if (existing?.status === 'succeeded') {
			return { queued: false as const, status: 'already_succeeded' as const };
		}

		if (existing) {
			await ctx.db.patch(existing._id, {
				userId,
				conversationId: args.conversationId,
				nodeId: args.nodeId,
				model: args.model,
				tokensUsed: args.tokensUsed,
				inputTokens: args.inputTokens,
				outputTokens: args.outputTokens,
				thinkingTokens: args.thinkingTokens,
				tokenCost: args.tokenCost,
				status: 'pending',
				nextRetryAt: now,
				lastError: args.failureReason ?? existing.lastError,
				updatedAt: now,
			});
			return { queued: true as const, status: 'updated_existing' as const };
		}

		await ctx.db.insert('usage_metering_jobs', {
			userId,
			conversationId: args.conversationId,
			nodeId: args.nodeId,
			model: args.model,
			tokensUsed: args.tokensUsed,
			inputTokens: args.inputTokens,
			outputTokens: args.outputTokens,
			thinkingTokens: args.thinkingTokens,
			tokenCost: args.tokenCost,
			status: 'pending',
			attempts: 0,
			nextRetryAt: now,
			lastError: args.failureReason,
			createdAt: now,
			updatedAt: now,
		});

		return { queued: true as const, status: 'inserted' as const };
	},
});

export const processUsageMeteringJob = internalMutation({
	args: {
		jobId: v.id('usage_metering_jobs'),
	},
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);
		if (!job) {
			return { processed: false as const, reason: 'not_found' as const };
		}
		if (job.status === 'succeeded') {
			return { processed: false as const, reason: 'already_succeeded' as const };
		}
		if (job.status === 'dead_letter') {
			return { processed: false as const, reason: 'dead_letter' as const };
		}

		const attempt = job.attempts + 1;
		await ctx.db.patch(job._id, {
			status: 'processing',
			attempts: attempt,
			updatedAt: Date.now(),
		});

		try {
			await recordUsageForUser(ctx, job.userId, {
				conversationId: job.conversationId,
				nodeId: job.nodeId,
				model: job.model,
				tokensUsed: job.tokensUsed,
				inputTokens: job.inputTokens,
				outputTokens: job.outputTokens,
				thinkingTokens: job.thinkingTokens,
				tokenCost: job.tokenCost,
			});

			await ctx.db.patch(job._id, {
				status: 'succeeded',
				lastError: undefined,
				processedAt: Date.now(),
				updatedAt: Date.now(),
			});
			return { processed: true as const, status: 'succeeded' as const };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const deadLetter = attempt >= MAX_METERING_RETRIES;
			const retryDelayMs = BASE_METERING_RETRY_MS * 2 ** Math.min(attempt, 6);
			await ctx.db.patch(job._id, {
				status: deadLetter ? 'dead_letter' : 'failed',
				lastError: message,
				nextRetryAt: Date.now() + retryDelayMs,
				updatedAt: Date.now(),
			});

			if (deadLetter) {
				await ctx.db.insert('billing_alerts', {
					source: 'invoice',
					severity: 'error',
					message: 'Usage metering job reached dead-letter state',
					context: JSON.stringify({
						jobId: job._id,
						nodeId: job.nodeId,
						userId: job.userId,
						error: message,
					}),
					createdAt: Date.now(),
					notificationAttempts: 0,
				});
			}

			return {
				processed: false as const,
				status: deadLetter ? ('dead_letter' as const) : ('failed' as const),
			};
		}
	},
});

export const processPendingUsageMeteringJobs = internalAction({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		scanned: number;
		succeeded: number;
		failed: number;
		deadLettered: number;
	}> => {
		const limit = args.limit ?? 25;
		const now = Date.now();
		const [pending, failed]: Array<any[]> = await Promise.all([
			ctx.runQuery(internal.usage.listUsageMeteringJobsByStatus, {
				status: 'pending',
				limit,
			}),
			ctx.runQuery(internal.usage.listUsageMeteringJobsByStatus, {
				status: 'failed',
				limit,
			}),
		]);

		const candidates: any[] = [...pending, ...failed]
			.filter((job) => job.nextRetryAt <= now)
			.sort((a, b) => a.nextRetryAt - b.nextRetryAt)
			.slice(0, limit);

		let succeeded = 0;
		let failedCount = 0;
		let deadLettered = 0;
		for (const job of candidates) {
			const result = await ctx.runMutation(internal.usage.processUsageMeteringJob, {
				jobId: job._id,
			});
			if (result.status === 'succeeded') succeeded++;
			if (result.status === 'failed') failedCount++;
			if (result.status === 'dead_letter') deadLettered++;
		}

		return {
			scanned: candidates.length,
			succeeded,
			failed: failedCount,
			deadLettered,
		};
	},
});

export const listUsageMeteringJobsByStatus = internalQuery({
	args: {
		status: v.union(v.literal('pending'), v.literal('failed')),
		limit: v.number(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query('usage_metering_jobs')
			.withIndex('status', (q) => q.eq('status', args.status))
			.take(args.limit);
	},
});

/**
 * Get usage records for a user
 */
export const getUserUsageRecords = query({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const limit = args.limit || 100;
		const records = await ctx.db
			.query('usage_records')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.order('desc')
			.take(limit);

		return records;
	},
});

/**
 * Get usage records for a conversation
 */
export const getConversationUsage = query({
	args: {
		conversationId: v.id('conversations'),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation) {
			return {
				records: [],
				totalTokens: 0,
				totalCost: 0,
			};
		}
		if (conversation.userId !== userId) {
			throw new Error('Forbidden');
		}

		const records = await ctx.db
			.query('usage_records')
			.withIndex('conversationId', (q) =>
				q.eq('conversationId', args.conversationId),
			)
			.collect();

		const totalTokens = records.reduce(
			(sum, record) => sum + record.tokensUsed,
			0,
		);
		const totalCost = records.reduce(
			(sum, record) => sum + record.tokenCost,
			0,
		);

		return {
			records,
			totalTokens,
			totalCost,
		};
	},
});

/**
 * Get current billing cycle usage
 */
export const getCurrentCycleUsage = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const subscription = await ctx.db
			.query('subscriptions')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.first();
		const activeCycles = await ctx.db
			.query('billing_cycles')
			.withIndex('userId', (q) => q.eq('userId', userId))
			.filter((q) => q.eq(q.field('status'), 'active'))
			.collect();

		const billingCycle =
			subscription && isBillingEntitledSubscriptionStatus(subscription.status)
				? activeCycles.find(
						(cycle) =>
							cycle.subscriptionId === subscription._id &&
							cycle.periodStart === subscription.currentPeriodStart &&
							cycle.periodEnd === subscription.currentPeriodEnd,
					)
				: activeCycles.sort((a, b) => b.periodEnd - a.periodEnd)[0];

		if (!billingCycle) {
			return null;
		}

		// Get all usage records for this cycle
		const records = await ctx.db
			.query('usage_records')
			.withIndex('billingCycleId', (q) =>
				q.eq('billingCycleId', billingCycle._id),
			)
			.collect();

		return {
			billingCycle,
			records,
		};
	},
});

/**
 * Aggregate usage by billing cycle
 */
export const aggregateUsageByCycle = query({
	args: {
		billingCycleId: v.id('billing_cycles'),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const billingCycle = await ctx.db.get(args.billingCycleId);
		if (!billingCycle || billingCycle.userId !== userId) {
			throw new Error('Forbidden');
		}
		const records = await ctx.db
			.query('usage_records')
			.withIndex('billingCycleId', (q) =>
				q.eq('billingCycleId', args.billingCycleId),
			)
			.collect();

		const totalTokens = records.reduce(
			(sum, record) => sum + record.tokensUsed,
			0,
		);
		const totalCost = records.reduce(
			(sum, record) => sum + record.tokenCost,
			0,
		);

		// Group by model
		const byModel = records.reduce(
			(acc, record) => {
				if (!acc[record.model]) {
					acc[record.model] = { tokens: 0, cost: 0 };
				}
				acc[record.model].tokens += record.tokensUsed;
				acc[record.model].cost += record.tokenCost;
				return acc;
			},
			{} as Record<string, { tokens: number; cost: number }>,
		);

		return {
			totalTokens,
			totalCost,
			byModel,
			recordCount: records.length,
		};
	},
});

/**
 * Get cumulative token usage for a conversation (for free tier limit checking)
 */
export const getConversationTokenTotal = query({
	args: {
		conversationId: v.id('conversations'),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		const conversation = await ctx.db.get(args.conversationId);
		if (!conversation || conversation.userId !== userId) {
			throw new Error('Forbidden');
		}

		const freeTierUsage = await ctx.db
			.query('free_tier_usage')
			.withIndex('conversationId', (q) =>
				q.eq('conversationId', args.conversationId),
			)
			.first();

		if (freeTierUsage) {
			return freeTierUsage.tokensUsed;
		}

		// Fallback: sum from usage_records
		const records = await ctx.db
			.query('usage_records')
			.withIndex('conversationId', (q) =>
				q.eq('conversationId', args.conversationId),
			)
			.collect();

		return records.reduce((sum, record) => sum + record.tokensUsed, 0);
	},
});

/**
 * Find all active billing cycles that have expired (periodEnd < now).
 * Joins with subscriptions to include the stripeCustomerId for Stripe API calls.
 * Used by the overage billing cron job.
 */
export const getExpiredActiveCycles = internalQuery({
	handler: async (ctx) => {
		const now = Date.now();
		const activeCycles = await ctx.db
			.query('billing_cycles')
			.filter((q) => q.eq(q.field('status'), 'active'))
			.collect();

		const expired = [];
		for (const cycle of activeCycles) {
			if (cycle.periodEnd > now) continue;
			const subscription = await ctx.db.get(cycle.subscriptionId);
			if (!subscription) continue;
			expired.push({
				...cycle,
				stripeCustomerId: subscription.stripeCustomerId,
			});
		}
		return expired;
	},
});

export const getPendingCycles = internalQuery({
	handler: async (ctx) => {
		const pendingCycles = await ctx.db
			.query('billing_cycles')
			.filter((q) => q.eq(q.field('status'), 'pending'))
			.collect();

		const result = [];
		for (const cycle of pendingCycles) {
			const subscription = await ctx.db.get(cycle.subscriptionId);
			if (!subscription) continue;
			result.push({
				...cycle,
				stripeCustomerId: subscription.stripeCustomerId,
			});
		}
		return result;
	},
});

/**
 * Mark a billing cycle as completed and optionally store the Stripe invoice ID.
 * Called by the overage billing action after processing.
 */
export const completeBillingCycle = internalMutation({
	args: {
		billingCycleId: v.id('billing_cycles'),
		stripeInvoiceId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.billingCycleId, {
			status: 'completed',
			stripeInvoiceId: args.stripeInvoiceId,
		});
	},
});

/**
 * Transition a billing cycle to pending iff it is currently active.
 * Used as a lightweight lock before creating Stripe invoice artifacts.
 */
export const markBillingCyclePendingIfActive = internalMutation({
	args: {
		billingCycleId: v.id('billing_cycles'),
	},
	handler: async (ctx, args) => {
		const cycle = await ctx.db.get(args.billingCycleId);
		if (!cycle || cycle.status !== 'active') {
			return { updated: false };
		}

		await ctx.db.patch(args.billingCycleId, {
			status: 'pending',
		});
		return { updated: true };
	},
});

/**
 * Set billing cycle status explicitly (e.g. to recover pending->active on failure).
 */
export const setBillingCycleStatus = internalMutation({
	args: {
		billingCycleId: v.id('billing_cycles'),
		status: v.union(
			v.literal('active'),
			v.literal('pending'),
			v.literal('completed'),
		),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.billingCycleId, {
			status: args.status,
		});
	},
});
