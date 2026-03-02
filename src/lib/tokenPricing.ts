/**
 * Token pricing is defined alongside each model in MODELS.
 * These values represent the user-facing price per 1k tokens in USD.
 */

import { MODELS, type ModelConfig, type ModelId } from "./constants/models";

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
	const pricing: ModelConfig | undefined = MODELS[modelId];
	if (!pricing) {
		// Fallback to a conservative default if model not found
		return (inputTokens * 0.02 + outputTokens * 0.06) / 1000;
	}

	const inputCost = (inputTokens / 1000) * pricing.pricePer1kInput;
	const outputCost = (outputTokens / 1000) * pricing.pricePer1kOutput;
	const thinkingRate = pricing.pricePer1kThinking ?? pricing.pricePer1kOutput;
	const thinkingCost = (thinkingTokens / 1000) * thinkingRate;

	return inputCost + outputCost + thinkingCost;
}
