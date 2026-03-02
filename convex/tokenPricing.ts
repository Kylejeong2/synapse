import { internalMutation, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { requireAuthenticatedUserId } from './auth';
import { DEFAULT_TOKEN_PRICING_ROWS } from './defaultTokenPricing';

function requireBillingAdminUser(userId: string) {
	const adminIds = (process.env.BILLING_ADMIN_USER_IDS ?? '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);

	if (adminIds.length === 0 || !adminIds.includes(userId)) {
		throw new Error('Forbidden');
	}
}

/**
 * Calculate token cost for a given model and usage
 * This function uses pricing data from the token_pricing table
 */
export const calculateTokenCost = query({
	args: {
		model: v.string(),
		inputTokens: v.number(),
		outputTokens: v.number(),
		thinkingTokens: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		// Get pricing from database
		const pricing = await ctx.db
			.query('token_pricing')
			.withIndex('model', (q) => q.eq('model', args.model))
			.filter((q) => q.eq(q.field('isActive'), true))
			.first();

		if (!pricing) {
			// Fallback to default pricing if not found
			const defaultInputCost = 0.01;
			const defaultOutputCost = 0.03;
			const defaultMarkup = 2.5;
			const inputCost =
				(args.inputTokens / 1000) * defaultInputCost * defaultMarkup;
			const outputCost =
				(args.outputTokens / 1000) * defaultOutputCost * defaultMarkup;
			return inputCost + outputCost;
		}

		const inputCost =
			(args.inputTokens / 1000) *
			pricing.providerCostPer1kInput *
			pricing.markupMultiplier;
		const outputCost =
			(args.outputTokens / 1000) *
			pricing.providerCostPer1kOutput *
			pricing.markupMultiplier;
		const thinkingCost = pricing.providerCostPer1kThinking
			? ((args.thinkingTokens || 0) / 1000) *
			  pricing.providerCostPer1kThinking *
			  pricing.markupMultiplier
			: 0;

		return inputCost + outputCost + thinkingCost;
	},
});

export const hasActiveModelPricing = query({
	args: {
		model: v.string(),
	},
	handler: async (ctx, args) => {
		const pricing = await ctx.db
			.query('token_pricing')
			.withIndex('model', (q) => q.eq('model', args.model))
			.filter((q) => q.eq(q.field('isActive'), true))
			.first();
		return Boolean(pricing);
	},
});

export const listActivePricedModels = query({
	args: {},
	handler: async (ctx) => {
		const rows = await ctx.db
			.query('token_pricing')
			.withIndex('isActive', (q) => q.eq('isActive', true))
			.collect();
		return rows.map((row) => row.model);
	},
});

const pricingRowInput = {
	model: v.string(),
	providerCostPer1kInput: v.number(),
	providerCostPer1kOutput: v.number(),
	providerCostPer1kThinking: v.optional(v.number()),
	markupMultiplier: v.number(),
	isActive: v.optional(v.boolean()),
};

function buildTokenPricingPatch(args: {
	providerCostPer1kInput: number;
	providerCostPer1kOutput: number;
	providerCostPer1kThinking?: number;
	markupMultiplier: number;
	isActive?: boolean;
}) {
	const pricePerTokenInput =
		(args.providerCostPer1kInput * args.markupMultiplier) / 1000;
	const pricePerTokenOutput =
		(args.providerCostPer1kOutput * args.markupMultiplier) / 1000;
	const pricePerTokenThinking =
		args.providerCostPer1kThinking === undefined
			? undefined
			: (args.providerCostPer1kThinking * args.markupMultiplier) / 1000;

	return {
		providerCostPer1kInput: args.providerCostPer1kInput,
		providerCostPer1kOutput: args.providerCostPer1kOutput,
		providerCostPer1kThinking: args.providerCostPer1kThinking,
		markupMultiplier: args.markupMultiplier,
		pricePerTokenInput,
		pricePerTokenOutput,
		pricePerTokenThinking,
		isActive: args.isActive ?? true,
		updatedAt: Date.now(),
	};
}

/**
 * Admin-only pricing upsert for a single model.
 */
export const upsertModelPricing = mutation({
	args: pricingRowInput,
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		requireBillingAdminUser(userId);

		const patch = buildTokenPricingPatch(args);
		const existing = await ctx.db
			.query('token_pricing')
			.withIndex('model', (q) => q.eq('model', args.model))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, patch);
			return { action: 'updated' as const };
		}

		await ctx.db.insert('token_pricing', {
			model: args.model,
			...patch,
		});
		return { action: 'inserted' as const };
	},
});

/**
 * Admin-only bulk seed/upsert for token pricing rows.
 */
export const bulkUpsertModelPricing = mutation({
	args: {
		rows: v.array(v.object(pricingRowInput)),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		requireBillingAdminUser(userId);

		let inserted = 0;
		let updated = 0;
		for (const row of args.rows) {
			const patch = buildTokenPricingPatch(row);
			const existing = await ctx.db
				.query('token_pricing')
				.withIndex('model', (q) => q.eq('model', row.model))
				.first();

			if (existing) {
				await ctx.db.patch(existing._id, patch);
				updated++;
			} else {
				await ctx.db.insert('token_pricing', {
					model: row.model,
					...patch,
				});
				inserted++;
			}
		}

		return { inserted, updated, total: args.rows.length };
	},
});

/**
 * Admin-only deactivation guardrail.
 */
export const deactivateModelPricing = mutation({
	args: {
		model: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await requireAuthenticatedUserId(ctx);
		requireBillingAdminUser(userId);
		const existing = await ctx.db
			.query('token_pricing')
			.withIndex('model', (q) => q.eq('model', args.model))
			.first();
		if (!existing) {
			return { updated: false as const };
		}
		await ctx.db.patch(existing._id, {
			isActive: false,
			updatedAt: Date.now(),
		});
		return { updated: true as const };
	},
});

/**
 * Admin-only bootstrap that upserts canonical pricing rows for all supported models.
 */
export const seedDefaultModelPricing = mutation({
	args: {},
	handler: async (ctx) => {
		const userId = await requireAuthenticatedUserId(ctx);
		requireBillingAdminUser(userId);

		let inserted = 0;
		let updated = 0;
		for (const row of DEFAULT_TOKEN_PRICING_ROWS) {
			const patch = buildTokenPricingPatch(row);
			const existing = await ctx.db
				.query('token_pricing')
				.withIndex('model', (q) => q.eq('model', row.model))
				.first();

			if (existing) {
				await ctx.db.patch(existing._id, patch);
				updated++;
			} else {
				await ctx.db.insert('token_pricing', {
					model: row.model,
					...patch,
				});
				inserted++;
			}
		}

		return {
			inserted,
			updated,
			total: DEFAULT_TOKEN_PRICING_ROWS.length,
		};
	},
});

/**
 * Auto-seed default pricing if the token_pricing table is empty.
 * Called by the cron scheduler on startup to ensure models are billable.
 */
export const ensureDefaultPricingSeeded = internalMutation({
	handler: async (ctx) => {
		const anyRow = await ctx.db
			.query('token_pricing')
			.first();

		if (anyRow) {
			return { seeded: false, reason: 'already_populated' as const };
		}

		let inserted = 0;
		for (const row of DEFAULT_TOKEN_PRICING_ROWS) {
			const patch = buildTokenPricingPatch(row);
			await ctx.db.insert('token_pricing', {
				model: row.model,
				...patch,
			});
			inserted++;
		}

		return { seeded: true, inserted };
	},
});
