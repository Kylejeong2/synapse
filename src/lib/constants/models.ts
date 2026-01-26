export type ModelProvider = "openai" | "anthropic" | "xai" | "google";

export interface ModelConfig {
	provider: ModelProvider;
	name: string;
	thinking: boolean;
}

export const MODELS = {
	// OpenAI
	"gpt-5.2-2025-12-11": {
		provider: "openai",
		name: "GPT-5.2",
		thinking: false,
	},
	"gpt-5.2-thinking-2025-12-11": {
		provider: "openai",
		name: "GPT-5.2 Thinking",
		thinking: true,
	},
	"gpt-5.1-2025-11-13": {
		provider: "openai",
		name: "GPT-5.1",
		thinking: false,
	},
	// "gpt-5-mini-2025-08-07": {
	// 	provider: "openai",
	// 	name: "GPT-5 Mini",
	// 	thinking: false,
	// },
	// "gpt-5-nano-2025-08-07": {
	// 	provider: "openai",
	// 	name: "GPT-5 Nano",
	// 	thinking: false,
	// },
	// "gpt-4.1-2025-04-14": {
	// 	provider: "openai",
	// 	name: "GPT-4.1",
	// 	thinking: false,
	// },
	// "gpt-4o-2024-08-06": {
	// 	provider: "openai",
	// 	name: "GPT-4o",
	// 	thinking: false,
	// },
	// "gpt-4o-mini-2024-07-18": {
	// 	provider: "openai",
	// 	name: "GPT-4o Mini",
	// 	thinking: false,
	// },
	// Anthropic
	"claude-sonnet-4-5-20250929": {
		provider: "anthropic",
		name: "Claude Sonnet 4.5",
		thinking: false,
	},
	"claude-sonnet-4-5-thinking-20250929": {
		provider: "anthropic",
		name: "Claude Sonnet 4.5 Extended Thinking",
		thinking: true,
	},
	"claude-haiku-4-5-20251001": {
		provider: "anthropic",
		name: "Claude Haiku 4.5",
		thinking: false,
	},
	"claude-opus-4-5-20251101": {
		provider: "anthropic",
		name: "Claude Opus 4.5",
		thinking: false,
	},
	"claude-opus-4-5-thinking-20251101": {
		provider: "anthropic",
		name: "Claude Opus 4.5 Extended Thinking",
		thinking: true,
	},
	// xAI
	// "grok-4-1-fast-reasoning": {
	// 	provider: "xai",
	// 	name: "Grok 4.1 Fast Reasoning",
	// 	thinking: true,
	// },
	// "grok-4-1-fast-non-reasoning": {
	// 	provider: "xai",
	// 	name: "Grok 4.1 Fast Non-Reasoning",
	// 	thinking: false,
	// },
	// // Google
	// "gemini-3-pro-preview": {
	// 	provider: "google",
	// 	name: "Gemini 3 Pro (Preview)",
	// 	thinking: true,
	// },
	// "gemini-2.5-flash": {
	// 	provider: "google",
	// 	name: "Gemini 2.5 Flash",
	// 	thinking: false,
	// },
	// "gemini-2.5-pro": {
	// 	provider: "google",
	// 	name: "Gemini 2.5 Pro",
	// 	thinking: true,
	// },
	// "gemini-2.5-flash-lite": {
	// 	provider: "google",
	// 	name: "Gemini 2.5 Flash Lite",
	// 	thinking: false,
	// },
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
