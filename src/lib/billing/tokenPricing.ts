/**
 * Token pricing configuration
 * Maps model IDs to provider costs and markup multipliers
 *
 * Pricing is stored as cost per 1k tokens from the provider
 * Markup multiplier is applied to calculate final price
 */

import type { ModelId } from "../constants/models";

export interface TokenPricingConfig {
	/** Provider cost per 1k input tokens (in dollars) */
	inputCostPer1k: number;
	/** Provider cost per 1k output tokens (in dollars) */
	outputCostPer1k: number;
	/** Provider cost per 1k thinking tokens (in dollars, optional) */
	thinkingCostPer1k?: number;
	/** Markup multiplier (e.g., 2.5 for 2.5x markup) */
	markupMultiplier: number;
}

/**
 * Pricing lookup table for all models
 * Costs are approximate and should be updated based on actual provider pricing
 * Markup is set to 2.5x by default (can be adjusted per model)
 */
export const TOKEN_PRICING: Record<ModelId, TokenPricingConfig> = {
	// OpenAI Models
	"gpt-5.2-2025-12-11": {
		inputCostPer1k: 0.01,
		outputCostPer1k: 0.03,
		markupMultiplier: 2.5,
	},
	"gpt-5.2-thinking-2025-12-11": {
		inputCostPer1k: 0.01,
		outputCostPer1k: 0.03,
		thinkingCostPer1k: 0.02,
		markupMultiplier: 2.5,
	},
	"gpt-5.1-2025-11-13": {
		inputCostPer1k: 0.01,
		outputCostPer1k: 0.03,
		markupMultiplier: 2.5,
	},
	"gpt-5-mini-2025-08-07": {
		inputCostPer1k: 0.002,
		outputCostPer1k: 0.006,
		markupMultiplier: 2.5,
	},
	"gpt-5-nano-2025-08-07": {
		inputCostPer1k: 0.001,
		outputCostPer1k: 0.003,
		markupMultiplier: 2.5,
	},
	"gpt-4.1-2025-04-14": {
		inputCostPer1k: 0.01,
		outputCostPer1k: 0.03,
		markupMultiplier: 2.5,
	},
	"gpt-4o-2024-08-06": {
		inputCostPer1k: 0.005,
		outputCostPer1k: 0.015,
		markupMultiplier: 2.5,
	},
	"gpt-4o-mini-2024-07-18": {
		inputCostPer1k: 0.00015,
		outputCostPer1k: 0.0006,
		markupMultiplier: 2.5,
	},
	// Anthropic Models
	"claude-sonnet-4-5-20250929": {
		inputCostPer1k: 0.003,
		outputCostPer1k: 0.015,
		markupMultiplier: 2.5,
	},
	"claude-sonnet-4-5-thinking-20250929": {
		inputCostPer1k: 0.003,
		outputCostPer1k: 0.015,
		thinkingCostPer1k: 0.01,
		markupMultiplier: 2.5,
	},
	"claude-haiku-4-5-20251001": {
		inputCostPer1k: 0.00025,
		outputCostPer1k: 0.00125,
		markupMultiplier: 2.5,
	},
	"claude-opus-4-5-20251101": {
		inputCostPer1k: 0.015,
		outputCostPer1k: 0.075,
		markupMultiplier: 2.5,
	},
	"claude-opus-4-5-thinking-20251101": {
		inputCostPer1k: 0.015,
		outputCostPer1k: 0.075,
		thinkingCostPer1k: 0.05,
		markupMultiplier: 2.5,
	},
	// xAI Models
	"grok-4-1-fast-reasoning": {
		inputCostPer1k: 0.002,
		outputCostPer1k: 0.008,
		thinkingCostPer1k: 0.005,
		markupMultiplier: 2.5,
	},
	"grok-4-1-fast-non-reasoning": {
		inputCostPer1k: 0.002,
		outputCostPer1k: 0.008,
		markupMultiplier: 2.5,
	},
	// Google Models
	"gemini-3-pro-preview": {
		inputCostPer1k: 0.00125,
		outputCostPer1k: 0.005,
		thinkingCostPer1k: 0.003,
		markupMultiplier: 2.5,
	},
	"gemini-2.5-flash": {
		inputCostPer1k: 0.000075,
		outputCostPer1k: 0.0003,
		markupMultiplier: 2.5,
	},
	"gemini-2.5-pro": {
		inputCostPer1k: 0.00125,
		outputCostPer1k: 0.005,
		thinkingCostPer1k: 0.003,
		markupMultiplier: 2.5,
	},
	"gemini-2.5-flash-lite": {
		inputCostPer1k: 0.0000375,
		outputCostPer1k: 0.00015,
		markupMultiplier: 2.5,
	},
};

/**
 * Calculate the cost for token usage
 * @param modelId - The model identifier
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param thinkingTokens - Number of thinking tokens (optional)
 * @returns Total cost in dollars
 */
export function calculateTokenCost(
	modelId: ModelId,
	inputTokens: number,
	outputTokens: number,
	thinkingTokens: number = 0,
): number {
	const pricing = TOKEN_PRICING[modelId];
	if (!pricing) {
		// Fallback to default pricing if model not found
		return ((inputTokens * 0.01 + outputTokens * 0.03) / 1000) * 2.5;
	}

	const inputCost =
		(inputTokens / 1000) * pricing.inputCostPer1k * pricing.markupMultiplier;
	const outputCost =
		(outputTokens / 1000) * pricing.outputCostPer1k * pricing.markupMultiplier;
	const thinkingCost = pricing.thinkingCostPer1k
		? (thinkingTokens / 1000) *
			pricing.thinkingCostPer1k *
			pricing.markupMultiplier
		: 0;

	return inputCost + outputCost + thinkingCost;
}

/**
 * Get pricing configuration for a model
 */
export function getPricingConfig(
	modelId: ModelId,
): TokenPricingConfig | undefined {
	return TOKEN_PRICING[modelId];
}
