export type ModelProvider = "openai" | "anthropic" | "xai" | "google";

export interface ModelConfig {
	provider: ModelProvider;
	name: string;
	thinking: boolean;
	pricePer1kInput: number;
	pricePer1kOutput: number;
	pricePer1kThinking?: number;
}

export const MODELS = {
	// OpenAI – https://openai.com/api/pricing, https://platform.openai.com/docs/pricing
	"gpt-5.2-2025-12-11": {
		provider: "openai",
		name: "GPT-5.2",
		thinking: false,
		pricePer1kInput: 0.00175, // $1.75/M
		pricePer1kOutput: 0.014, // $14/M
	},
	"gpt-5.2-thinking-2025-12-11": {
		provider: "openai",
		name: "GPT-5.2 Thinking",
		thinking: true,
		pricePer1kInput: 0.00175,
		pricePer1kOutput: 0.014,
		pricePer1kThinking: 0.014, // reasoning tokens billed as output
	},
	"gpt-5.1-2025-11-13": {
		provider: "openai",
		name: "GPT-5.1",
		thinking: false,
		pricePer1kInput: 0.00125, // $1.25/M
		pricePer1kOutput: 0.01, // $10/M
	},
	// Anthropic – https://docs.anthropic.com/en/docs/about-claude/pricing
	"claude-sonnet-4-5-20250929": {
		provider: "anthropic",
		name: "Claude Sonnet 4.5",
		thinking: false,
		pricePer1kInput: 0.003, // $3/M
		pricePer1kOutput: 0.015, // $15/M
	},
	"claude-sonnet-4-5-thinking-20250929": {
		provider: "anthropic",
		name: "Claude Sonnet 4.5 Extended Thinking",
		thinking: true,
		pricePer1kInput: 0.003,
		pricePer1kOutput: 0.015,
		pricePer1kThinking: 0.015, // thinking tokens billed as output
	},
	"claude-haiku-4-5-20251001": {
		provider: "anthropic",
		name: "Claude Haiku 4.5",
		thinking: false,
		pricePer1kInput: 0.001, // $1/M
		pricePer1kOutput: 0.005, // $5/M
	},
	"claude-opus-4-5-20251101": {
		provider: "anthropic",
		name: "Claude Opus 4.5",
		thinking: false,
		pricePer1kInput: 0.005, // $5/M
		pricePer1kOutput: 0.025, // $25/M
	},
	"claude-opus-4-5-thinking-20251101": {
		provider: "anthropic",
		name: "Claude Opus 4.5 Extended Thinking",
		thinking: true,
		pricePer1kInput: 0.005,
		pricePer1kOutput: 0.025,
		pricePer1kThinking: 0.025, // thinking tokens billed as output
	},
} as const satisfies Record<string, ModelConfig>;

export type ModelId = keyof typeof MODELS;

export const DEFAULT_MODEL: ModelId = "gpt-5.2-2025-12-11";

export const PROVIDER_NAMES: Record<ModelProvider, string> = {
	openai: "OpenAI",
	anthropic: "Anthropic",
	xai: "xAI",
	google: "Google",
};

// Group models by provider for dropdown
export const MODELS_BY_PROVIDER = Object.entries(MODELS).reduce(
	(acc, [id, config]) => {
		const provider = config.provider as ModelProvider;
		if (!acc[provider]) acc[provider] = [];
		acc[provider].push({ id: id as ModelId, ...config });
		return acc;
	},
	{} as Record<ModelProvider, Array<{ id: ModelId } & ModelConfig>>,
);
