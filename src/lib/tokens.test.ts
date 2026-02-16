import { describe, expect, it } from "vitest";
import type { ModelConfig } from "./constants/models";
import { calculateTotalTokens } from "./tokens";

const nonThinking: ModelConfig = {
	provider: "openai",
	name: "GPT-5.2",
	thinking: false,
};

const thinking: ModelConfig = {
	provider: "anthropic",
	name: "Claude Sonnet 4.5 Thinking",
	thinking: true,
};

describe("calculateTotalTokens", () => {
	describe("invalid inputs", () => {
		it("returns -1 for null usage", () => {
			const result = calculateTotalTokens(
				null as unknown as Record<string, unknown>,
				nonThinking,
			);
			expect(result).toEqual({
				total: -1,
				prompt: 0,
				completion: 0,
				thinking: 0,
			});
		});

		it("returns -1 for negative token counts", () => {
			const result = calculateTotalTokens(
				{ promptTokens: -5, completionTokens: 100 },
				nonThinking,
			);
			expect(result).toEqual({
				total: -1,
				prompt: 0,
				completion: 0,
				thinking: 0,
			});
		});

		it("returns -1 for negative totalTokens", () => {
			const result = calculateTotalTokens(
				{ totalTokens: -1, promptTokens: 10, completionTokens: 20 },
				nonThinking,
			);
			expect(result).toEqual({
				total: -1,
				prompt: 0,
				completion: 0,
				thinking: 0,
			});
		});
	});

	describe("non-thinking models", () => {
		it("sums prompt and completion tokens", () => {
			const result = calculateTotalTokens(
				{ promptTokens: 100, completionTokens: 200 },
				nonThinking,
			);
			expect(result).toEqual({
				total: 300,
				prompt: 100,
				completion: 200,
				thinking: 0,
			});
		});

		it("prefers SDK totalTokens when available", () => {
			const result = calculateTotalTokens(
				{ promptTokens: 100, completionTokens: 200, totalTokens: 350 },
				nonThinking,
			);
			expect(result.total).toBe(350);
		});

		it("falls back to inputTokens/outputTokens field names", () => {
			const result = calculateTotalTokens(
				{ inputTokens: 50, outputTokens: 150 },
				nonThinking,
			);
			expect(result).toEqual({
				total: 200,
				prompt: 50,
				completion: 150,
				thinking: 0,
			});
		});

		it("uses totalTokens when no individual counts", () => {
			const result = calculateTotalTokens({ totalTokens: 500 }, nonThinking);
			expect(result.total).toBe(500);
		});

		it("returns -1 when no token data at all", () => {
			const result = calculateTotalTokens({}, nonThinking);
			expect(result.total).toBe(-1);
		});

		it("ignores thinking tokens for non-thinking models", () => {
			const result = calculateTotalTokens(
				{
					promptTokens: 100,
					completionTokens: 200,
					thinkingTokens: 500,
				},
				nonThinking,
			);
			expect(result.thinking).toBe(0);
		});
	});

	describe("thinking models", () => {
		it("includes thinking tokens in total", () => {
			const result = calculateTotalTokens(
				{
					promptTokens: 100,
					completionTokens: 200,
					thinkingTokens: 300,
				},
				thinking,
			);
			expect(result).toEqual({
				total: 600,
				prompt: 100,
				completion: 200,
				thinking: 300,
			});
		});

		it("uses higher of calculated vs SDK total", () => {
			const result = calculateTotalTokens(
				{
					promptTokens: 100,
					completionTokens: 200,
					thinkingTokens: 300,
					totalTokens: 400,
				},
				thinking,
			);
			// calculated = 600, SDK says 400, use max = 600
			expect(result.total).toBe(600);
		});

		it("uses SDK total when higher than calculated", () => {
			const result = calculateTotalTokens(
				{
					promptTokens: 100,
					completionTokens: 200,
					thinkingTokens: 300,
					totalTokens: 800,
				},
				thinking,
			);
			expect(result.total).toBe(800);
		});

		it("falls back to reasoningTokens field name", () => {
			const result = calculateTotalTokens(
				{
					promptTokens: 50,
					completionTokens: 100,
					reasoningTokens: 200,
				},
				thinking,
			);
			expect(result.thinking).toBe(200);
			expect(result.total).toBe(350);
		});

		it("falls back to thoughtTokens field name", () => {
			const result = calculateTotalTokens(
				{
					promptTokens: 50,
					completionTokens: 100,
					thoughtTokens: 150,
				},
				thinking,
			);
			expect(result.thinking).toBe(150);
		});

		it("uses totalTokens when no individual counts", () => {
			const result = calculateTotalTokens({ totalTokens: 1000 }, thinking);
			expect(result.total).toBe(1000);
		});

		it("returns -1 when no token data at all", () => {
			const result = calculateTotalTokens({}, thinking);
			expect(result.total).toBe(-1);
		});
	});
});
