import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import { createFileRoute } from "@tanstack/react-router";
import { type LanguageModel, streamText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SYSTEM_PROMPT } from "../lib/constants";
import {
	DEFAULT_MODEL,
	MODELS,
	type ModelConfig,
	type ModelId,
	type ModelProvider,
} from "../lib/constants/models";

/**
 * Token usage object structure from AI SDK
 * Different providers may expose different fields
 */
interface TokenUsage {
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
 * Convex HTTP client for server-side database operations
 */
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "";
if (!CONVEX_URL) {
	throw new Error("VITE_CONVEX_URL environment variable is not set");
}
const convexClient = new ConvexHttpClient(CONVEX_URL);

/**
 * Calculate total tokens including thinking tokens for thinking models
 * Handles different provider token reporting formats
 */
function calculateTotalTokens(
	usage: TokenUsage,
	modelConfig: ModelConfig,
): number {
	// Validate usage object exists
	if (!usage || typeof usage !== "object") {
		console.warn("[Token Counting] Invalid usage object:", usage);
		return -1;
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
		console.warn("[Token Counting] Negative token count detected:", {
			promptTokens,
			completionTokens,
			thinkingTokens,
			totalTokens,
		});
	}

	// For thinking models, explicitly calculate total including thinking tokens
	if (isThinkingModel) {
		// If we have individual token counts, sum them
		if (promptTokens > 0 || completionTokens > 0 || thinkingTokens > 0) {
			const calculatedTotal = promptTokens + completionTokens + thinkingTokens;

			// Log detailed breakdown for thinking models
			console.log(
				`[Token Counting] ${modelConfig.name} (${modelConfig.provider}):`,
				{
					promptTokens,
					completionTokens,
					thinkingTokens,
					calculatedTotal,
					totalTokensFromSDK: totalTokens,
					usageObject: usage,
				},
			);

			// If SDK provides totalTokens, compare with our calculation
			if (totalTokens !== undefined) {
				const difference = Math.abs(calculatedTotal - totalTokens);
				if (difference > 0) {
					console.log(
						`[Token Counting] Difference between calculated and SDK total: ${difference}`,
					);
				}
				// Use SDK total if it's higher (might include other tokens we're not tracking)
				return Math.max(calculatedTotal, totalTokens);
			}

			return calculatedTotal;
		}

		// Fallback to totalTokens if individual counts aren't available
		if (totalTokens !== undefined && totalTokens >= 0) {
			console.log(
				`[Token Counting] ${modelConfig.name}: Using SDK totalTokens: ${totalTokens}`,
			);
			return totalTokens;
		}

		console.warn(
			`[Token Counting] ${modelConfig.name}: Unable to determine token count`,
			usage,
		);
		return -1;
	}

	// For non-thinking models, use standard calculation
	if (promptTokens > 0 || completionTokens > 0) {
		const calculatedTotal = promptTokens + completionTokens;

		// If SDK provides totalTokens, prefer it (might be more accurate)
		if (totalTokens !== undefined && totalTokens >= 0) {
			return totalTokens;
		}

		return calculatedTotal;
	}

	// Final fallback to totalTokens
	if (totalTokens !== undefined && totalTokens >= 0) {
		return totalTokens;
	}

	// If we can't determine token count, log warning and return -1
	console.warn(
		"[Token Counting] Unable to determine token count from usage object:",
		usage,
	);
	return -1;
}

/**
 * Get the appropriate model instance based on provider and model ID
 */
function getModelInstance(modelId: ModelId): LanguageModel {
	const config = MODELS[modelId];
	if (!config) {
		console.warn(`Unknown model: ${modelId}, falling back to default`);
		return openai(DEFAULT_MODEL);
	}

	const provider = config.provider as ModelProvider;

	switch (provider) {
		case "openai":
			return openai(modelId);
		case "anthropic":
			return anthropic(modelId);
		case "xai":
			return xai(modelId);
		case "google":
			return google(modelId);
		default:
			console.warn(`Unknown provider: ${provider}, falling back to OpenAI`);
			return openai(modelId);
	}
}

/**
 * API route for handling chat requests with streaming responses
 * Fetches conversation context, streams model responses, and saves to database
 */
export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const body = await request.json();
					const {
						messages: incomingMessages,
						nodeId,
						conversationId,
						model: requestedModel,
					} = body;

					// Validate and use the requested model, or fall back to default
					const modelId: ModelId =
						requestedModel && requestedModel in MODELS
							? (requestedModel as ModelId)
							: DEFAULT_MODEL;

					const modelConfig = MODELS[modelId];

					console.log(
						`[Chat API] Using model: ${modelId} (provider: ${modelConfig.provider})`,
					);

					// Extract the latest user message
					const lastMessage = incomingMessages[incomingMessages.length - 1];
					const prompt = lastMessage.parts
						.map((p: { text?: string }) => p.text || "")
						.join("");

					// 1. Fetch context from Convex if nodeId exists
					let ancestors: Array<{
						userPrompt: string;
						assistantResponse: string;
						tokensUsed: number;
					}> = [];

					if (nodeId) {
						ancestors = await convexClient.query(api.nodes.getAncestors, {
							nodeId: nodeId as Id<"nodes">,
						});
					}

					// 2. Build messages array
					const messages: Array<{
						role: "user" | "assistant";
						content: string;
					}> = [];

					// Add ancestor context
					for (const ancestor of ancestors) {
						messages.push({ role: "user", content: ancestor.userPrompt });
						messages.push({
							role: "assistant",
							content: ancestor.assistantResponse,
						});
					}

					// Add new prompt
					messages.push({ role: "user", content: prompt });

					// 3. Calculate node position for the tree layout
					const depth = nodeId ? ancestors.length : 0;
					const position = {
						x: depth * 300,
						y: Math.random() * 100,
					};

					// 4. Stream from the model (throttled updates to Convex for near-realtime UI)
					let newNodeId: Id<"nodes">;

					// Get the model instance based on provider
					const modelInstance = getModelInstance(modelId);

					// Start model streaming and node creation in parallel
					const modelPromise = streamText({
						model: modelInstance,
						system: SYSTEM_PROMPT,
						messages,
						maxOutputTokens: 4096,
						temperature: modelConfig.thinking ? undefined : 0.7, // Thinking models often don't support temperature
						async onFinish({ text, usage, response }) {
							try {
								// Extract tool data from response if available
								const responseData = response as unknown as {
									toolCalls?: unknown[];
									toolResults?: unknown[];
								};
								const toolCalls = responseData.toolCalls || undefined;
								const toolResults = responseData.toolResults || undefined;

								// Calculate total tokens including thinking tokens for thinking models
								const totalTokens = calculateTotalTokens(
									usage as TokenUsage,
									modelConfig,
								);

								// Final patch with complete text, token usage, and tool data
								await convexClient.mutation(api.nodes.updateContent, {
									nodeId: newNodeId as Id<"nodes">,
									assistantResponse: text,
									tokensUsed: totalTokens,
									model: modelId,
									toolCalls,
									toolResults,
								});

								// Update last accessed time
								await convexClient.mutation(
									api.conversations.updateLastAccessed,
									{
										conversationId: conversationId as Id<"conversations">,
									},
								);
							} catch (error) {
								console.error(
									"[Chat API] Error updating Convex after completion:",
									error,
								);
							}
						},
					});

					// Create node and set root in parallel with model streaming
					const nodePromise = convexClient
						.mutation(api.nodes.create, {
							conversationId: conversationId as Id<"conversations">,
							parentId: nodeId ? (nodeId as Id<"nodes">) : undefined,
							userPrompt: prompt,
							assistantResponse: "",
							model: modelId,
							tokensUsed: 0,
							depth,
							position,
						})
						.then(async (id) => {
							// Set root if this is the first node
							if (!nodeId) {
								await convexClient.mutation(api.conversations.updateRootNode, {
									conversationId: conversationId as Id<"conversations">,
									rootNodeId: id,
								});
							}
							return id;
						});

					// Wait for both model and node creation
					const [result, _newNodeId] = await Promise.all([
						modelPromise,
						nodePromise,
					]);
					newNodeId = _newNodeId;

					// Tap into the text stream to patch partial content to Convex
					const [tapStream, clientStream] = result.textStream.tee();
					(async () => {
						const reader = tapStream.getReader();
						let streamedText = "";
						let lastPatched = 0;
						const THROTTLE_MS = 200;
						try {
							while (true) {
								const { value, done } = await reader.read();
								if (done) break;
								if (value) {
									streamedText += value;
									const now = Date.now();
									if (now - lastPatched >= THROTTLE_MS) {
										lastPatched = now;
										await convexClient.mutation(api.nodes.updateContent, {
											nodeId: newNodeId as Id<"nodes">,
											assistantResponse: streamedText,
											tokensUsed: 0,
											model: modelId,
										});
									}
								}
							}
						} catch (e) {
							console.error("Error reading text stream:", e);
						} finally {
							reader.releaseLock();
						}
					})();

					// Return the client stream as a text/plain streaming response
					return new Response(clientStream, {
						headers: { "Content-Type": "text/plain; charset=utf-8" },
					});
				} catch (error) {
					console.error("Chat API error:", error);
					return new Response(
						JSON.stringify({
							error: "Failed to process chat request",
							details: error instanceof Error ? error.message : String(error),
						}),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			},
		},
	},
});
