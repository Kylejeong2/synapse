export type DefaultTokenPricingRow = {
	model: string;
	providerCostPer1kInput: number;
	providerCostPer1kOutput: number;
	providerCostPer1kThinking?: number;
	markupMultiplier: number;
	isActive: boolean;
};

/**
 * Canonical pricing seed used to bootstrap token_pricing for all enabled models.
 * Values are defined as final sell-side rates (markup 1.0) and can be adjusted by admins later.
 */
export const DEFAULT_TOKEN_PRICING_ROWS: DefaultTokenPricingRow[] = [
	{
		model: 'gpt-5.2-2025-12-11',
		providerCostPer1kInput: 0.00175,
		providerCostPer1kOutput: 0.014,
		markupMultiplier: 1,
		isActive: true,
	},
	{
		model: 'gpt-5.2-thinking-2025-12-11',
		providerCostPer1kInput: 0.00175,
		providerCostPer1kOutput: 0.014,
		providerCostPer1kThinking: 0.014,
		markupMultiplier: 1,
		isActive: true,
	},
	{
		model: 'gpt-5.1-2025-11-13',
		providerCostPer1kInput: 0.00125,
		providerCostPer1kOutput: 0.01,
		markupMultiplier: 1,
		isActive: true,
	},
	{
		model: 'claude-sonnet-4-5-20250929',
		providerCostPer1kInput: 0.003,
		providerCostPer1kOutput: 0.015,
		markupMultiplier: 1,
		isActive: true,
	},
	{
		model: 'claude-sonnet-4-5-thinking-20250929',
		providerCostPer1kInput: 0.003,
		providerCostPer1kOutput: 0.015,
		providerCostPer1kThinking: 0.015,
		markupMultiplier: 1,
		isActive: true,
	},
	{
		model: 'claude-haiku-4-5-20251001',
		providerCostPer1kInput: 0.001,
		providerCostPer1kOutput: 0.005,
		markupMultiplier: 1,
		isActive: true,
	},
	{
		model: 'claude-opus-4-5-20251101',
		providerCostPer1kInput: 0.005,
		providerCostPer1kOutput: 0.025,
		markupMultiplier: 1,
		isActive: true,
	},
	{
		model: 'claude-opus-4-5-thinking-20251101',
		providerCostPer1kInput: 0.005,
		providerCostPer1kOutput: 0.025,
		providerCostPer1kThinking: 0.025,
		markupMultiplier: 1,
		isActive: true,
	},
];
