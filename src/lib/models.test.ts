import { describe, expect, it } from "vitest";
import {
	DEFAULT_MODEL,
	MODELS,
	MODELS_BY_PROVIDER,
	type ModelProvider,
	PROVIDER_NAMES,
} from "./constants/models";

describe("model configuration", () => {
	it("DEFAULT_MODEL exists in MODELS", () => {
		expect(MODELS[DEFAULT_MODEL]).toBeDefined();
	});

	it("every model has a valid provider", () => {
		const validProviders: ModelProvider[] = [
			"openai",
			"anthropic",
			"xai",
			"google",
		];
		for (const [, config] of Object.entries(MODELS)) {
			expect(validProviders).toContain(config.provider);
		}
	});

	it("every model has a non-empty name", () => {
		for (const [, config] of Object.entries(MODELS)) {
			expect(config.name.length).toBeGreaterThan(0);
		}
	});

	it("thinking field is a boolean for every model", () => {
		for (const [, config] of Object.entries(MODELS)) {
			expect(typeof config.thinking).toBe("boolean");
		}
	});

	it("MODELS_BY_PROVIDER contains all models", () => {
		const modelCountInGroups = Object.values(MODELS_BY_PROVIDER).reduce(
			(sum, group) => sum + group.length,
			0,
		);
		expect(modelCountInGroups).toBe(Object.keys(MODELS).length);
	});

	it("every provider in MODELS_BY_PROVIDER has a display name", () => {
		for (const provider of Object.keys(MODELS_BY_PROVIDER)) {
			expect(PROVIDER_NAMES[provider as ModelProvider]).toBeDefined();
		}
	});
});
