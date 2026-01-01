import { query } from './_generated/server';
import { v } from 'convex/values';

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

