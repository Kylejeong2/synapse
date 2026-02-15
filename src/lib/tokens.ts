import type { ModelConfig } from "./constants/models";

/**
 * Token usage object structure from AI SDK
 * Different providers may expose different fields
 */
export interface TokenUsage {
	/** Total tokens (may or may not include thinking tokens) */
	totalTokens?: number;
	/** Input/prompt tokens */
	promptTokens?: number;
	inputTokens?: number;
	/** Output/completion tokens */
	completionTokens?: number;
	outputTokens?: number;
	/** Thinking/reasoning tokens (for thinking models) */
	thinkingTokens?: number;
	reasoningTokens?: number;
	thoughtTokens?: number;
	/** Provider-specific fields */
	[x: string]: unknown;
}

/**
 * Calculate total tokens including thinking tokens for thinking models
 * Handles different provider token reporting formats
 */
export function calculateTotalTokens(
	usage: TokenUsage,
	modelConfig: ModelConfig,
): {
	total: number;
	prompt: number;
	completion: number;
	thinking: number;
} {
	// Validate usage object exists
	if (!usage || typeof usage !== "object") {
		return { total: -1, prompt: 0, completion: 0, thinking: 0 };
	}

	const isThinkingModel = modelConfig.thinking;

	// Extract token values with fallbacks for different field names
	const promptTokens = usage.promptTokens ?? usage.inputTokens ?? 0;
	const completionTokens = usage.completionTokens ?? usage.outputTokens ?? 0;
	const thinkingTokens =
		usage.thinkingTokens ?? usage.reasoningTokens ?? usage.thoughtTokens ?? 0;
	const totalTokens = usage.totalTokens;

	// Validate token counts are non-negative
	if (
		promptTokens < 0 ||
		completionTokens < 0 ||
		thinkingTokens < 0 ||
		(totalTokens !== undefined && totalTokens < 0)
	) {
		return { total: -1, prompt: 0, completion: 0, thinking: 0 };
	}

	// For thinking models, explicitly calculate total including thinking tokens
	if (isThinkingModel) {
		// If we have individual token counts, sum them
		if (promptTokens > 0 || completionTokens > 0 || thinkingTokens > 0) {
			const calculatedTotal = promptTokens + completionTokens + thinkingTokens;

			// If SDK provides totalTokens, use the higher value
			const finalTotal =
				totalTokens !== undefined
					? Math.max(calculatedTotal, totalTokens)
					: calculatedTotal;

			return {
				total: finalTotal,
				prompt: promptTokens,
				completion: completionTokens,
				thinking: thinkingTokens,
			};
		}

		// Fallback to totalTokens if individual counts aren't available
		if (totalTokens !== undefined && totalTokens >= 0) {
			return {
				total: totalTokens,
				prompt: promptTokens,
				completion: completionTokens,
				thinking: thinkingTokens,
			};
		}

		return { total: -1, prompt: 0, completion: 0, thinking: 0 };
	}

	// For non-thinking models, use standard calculation
	if (promptTokens > 0 || completionTokens > 0) {
		const calculatedTotal = promptTokens + completionTokens;

		// If SDK provides totalTokens, prefer it (might be more accurate)
		const finalTotal =
			totalTokens !== undefined && totalTokens >= 0
				? totalTokens
				: calculatedTotal;

		return {
			total: finalTotal,
			prompt: promptTokens,
			completion: completionTokens,
			thinking: 0,
		};
	}

	// Final fallback to totalTokens
	if (totalTokens !== undefined && totalTokens >= 0) {
		return {
			total: totalTokens,
			prompt: promptTokens,
			completion: completionTokens,
			thinking: 0,
		};
	}

	return { total: -1, prompt: 0, completion: 0, thinking: 0 };
}
