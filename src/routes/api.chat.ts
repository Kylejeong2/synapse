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
	type ModelId,
	type ModelProvider,
} from "../lib/constants/models";
import { FREE_TIER_MAX_TOKENS } from "../lib/constants/pricing";
import {
	type ChatRequestLog,
	generateRequestId,
	logger,
	Timer,
} from "../lib/logger";
import { requireClerkUserId } from "../lib/server/clerkAuth";
import { calculateTotalTokens, type TokenUsage } from "../lib/tokens";

/**
 * Convex HTTP client for server-side database operations
 */
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "";
if (!CONVEX_URL) {
	throw new Error("VITE_CONVEX_URL environment variable is not set");
}

function getBearerToken(request: Request): string | null {
	const authHeader = request.headers.get("authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return null;
	}
	const token = authHeader.slice("Bearer ".length).trim();
	return token || null;
}

/**
 * Get the appropriate model instance based on provider and model ID
 */
function getModelInstance(modelId: ModelId): LanguageModel {
	const config = MODELS[modelId];
	if (!config) {
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
				// Initialize request tracking
				const requestId = generateRequestId();
				const timer = new Timer();
				const logContext: Partial<ChatRequestLog> = {
					request_id: requestId,
					timestamp: Date.now(),
					service_name: "synapse-api",
					environment: import.meta.env.DEV ? "development" : "production",
					vite_mode: import.meta.env.MODE,
					streaming: true,
				};

				try {
					const auth = await requireClerkUserId(request);
					if ("response" in auth) {
						return auth.response;
					}
					const token = getBearerToken(request);
					if (!token) {
						return new Response(JSON.stringify({ error: "Unauthorized" }), {
							status: 401,
							headers: { "Content-Type": "application/json" },
						});
					}
					const convexClient = new ConvexHttpClient(CONVEX_URL);
					convexClient.setAuth(token);
					logContext.user_id = auth.userId;

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
					const hasPricingForModel = await convexClient.query(
						api.tokenPricing.hasActiveModelPricing,
						{ model: modelId },
					);
					if (!hasPricingForModel) {
						return new Response(
							JSON.stringify({
								error: "Model temporarily unavailable",
								message:
									"This model is not billable right now because active pricing is not configured.",
							}),
							{
								status: 503,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					// Add model info to log context
					logContext.model = modelId;
					logContext.model_provider = modelConfig.provider;
					logContext.conversation_id = conversationId;
					logContext.parent_node_id = nodeId;

					// Extract the latest user message
					const lastMessage = incomingMessages[incomingMessages.length - 1];
					const prompt = lastMessage.parts
						.map((p: { text?: string }) => p.text || "")
						.join("");

					logContext.prompt_length = prompt.length;

					// 0. Get conversation to extract userId and check limits
					timer.mark("convex_query_start");
					const conversation = await convexClient.query(
						api.conversations.getConversation,
						{
							conversationId: conversationId as Id<"conversations">,
						},
					);

					if (!conversation) {
						return new Response(
							JSON.stringify({ error: "Conversation not found" }),
							{
								status: 404,
								headers: { "Content-Type": "application/json" },
							},
						);
					}
					if (conversation.userId !== auth.userId) {
						return new Response(JSON.stringify({ error: "Forbidden" }), {
							status: 403,
							headers: { "Content-Type": "application/json" },
						});
					}

					// Check free tier token limits before processing
					const isFreeTier = await convexClient.query(
						api.rateLimiting.isFreeTier,
						{},
					);

					if (isFreeTier) {
						// Check cumulative tokens for this conversation
						const conversationTokens = await convexClient.query(
							api.usage.getConversationTokenTotal,
							{
								conversationId: conversationId as Id<"conversations">,
							},
						);

						if (conversationTokens >= FREE_TIER_MAX_TOKENS) {
							return new Response(
								JSON.stringify({
									error: "Free tier limit exceeded",
									message: `You've reached the ${FREE_TIER_MAX_TOKENS.toLocaleString()} token limit for free tier. Please upgrade to continue.`,
									upgradeRequired: true,
								}),
								{
									status: 403,
									headers: { "Content-Type": "application/json" },
								},
							);
						}
					}

					// Check rate limits and token credit
					const rateLimitCheck = await convexClient.query(
						api.rateLimiting.checkRateLimit,
						{},
					);

					if (!rateLimitCheck.allowed) {
						return new Response(
							JSON.stringify({
								error: "Rate limit exceeded",
								reason: rateLimitCheck.reason,
							}),
							{
								status: 429,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					// Estimate tokens for this request (rough estimate: prompt length / 4)
					const estimatedTokens = Math.ceil(prompt.length / 4) + 1000; // Add buffer for response
					const tokenLimitCheck = await convexClient.query(
						api.rateLimiting.checkTokenLimit,
						{ requestedTokens: estimatedTokens, model: modelId },
					);

					if (!tokenLimitCheck.allowed) {
						return new Response(
							JSON.stringify({
								error: "Token limit exceeded",
								reason: tokenLimitCheck.reason,
								...(tokenLimitCheck.reason === "spend_cap_exceeded"
									? {
											monthlySpendCap: tokenLimitCheck.monthlySpendCap,
											currentSpend: tokenLimitCheck.currentSpend,
											estimatedCost: tokenLimitCheck.estimatedCost,
										}
									: tokenLimitCheck.reason === "credit_exceeded"
										? {
												remainingCredit: tokenLimitCheck.remainingCredit,
												estimatedCost: tokenLimitCheck.estimatedCost,
											}
										: {
												tokensUsed: tokenLimitCheck.tokensUsed,
												maxTokens: tokenLimitCheck.maxTokens,
											}),
								upgradeRequired: true,
							}),
							{
								status: 403,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

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
					timer.mark("convex_query_end");

					logContext.ancestor_count = ancestors.length;
					logContext.convex_query_duration_ms = timer.duration(
						"convex_query_start",
						"convex_query_end",
					);

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

					logContext.depth = depth;
					logContext.is_fork = Boolean(nodeId);
					logContext.is_root = !nodeId;

					// 4. Create node before streaming so metering writes have a stable target id.
					const newNodeId = await convexClient
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

					// Get the model instance based on provider
					const modelInstance = getModelInstance(modelId);
					timer.mark("model_request_start");

					const result = streamText({
						model: modelInstance,
						system: SYSTEM_PROMPT,
						messages,
						maxOutputTokens: 4096,
						temperature: modelConfig.thinking ? undefined : 0.7, // Thinking models often don't support temperature
						async onFinish({ text, usage, response }) {
							try {
								timer.mark("model_complete");

								// Extract tool data from response if available
								const responseData = response as unknown as {
									toolCalls?: unknown[];
									toolResults?: unknown[];
								};
								const toolCalls = responseData.toolCalls || undefined;
								const toolResults = responseData.toolResults || undefined;

								// Calculate total tokens including thinking tokens for thinking models
								const tokenData = calculateTotalTokens(
									usage as TokenUsage,
									modelConfig,
								);

								// Update log context with response data
								logContext.response_length = text.length;
								logContext.tokens_prompt = tokenData.prompt;
								logContext.tokens_completion = tokenData.completion;
								logContext.tokens_thinking = tokenData.thinking || undefined;
								logContext.tokens_total = tokenData.total;

								timer.mark("convex_mutation_start");
								// Final patch with complete text, token usage, and tool data
								await convexClient.mutation(api.nodes.updateContent, {
									nodeId: newNodeId as Id<"nodes">,
									assistantResponse: text,
									tokensUsed: tokenData.total,
									model: modelId,
									toolCalls,
									toolResults,
								});

								// Record usage. If this fails, enqueue for durable retry.
								try {
									await convexClient.mutation(api.usage.recordUsage, {
										conversationId: conversationId as Id<"conversations">,
										nodeId: newNodeId as Id<"nodes">,
										model: modelId,
										tokensUsed: tokenData.total,
										inputTokens: tokenData.prompt,
										outputTokens: tokenData.completion,
										thinkingTokens: tokenData.thinking || 0,
									});
								} catch (usageError) {
									await convexClient.mutation(
										api.usage.enqueueUsageMeteringJob,
										{
											conversationId: conversationId as Id<"conversations">,
											nodeId: newNodeId as Id<"nodes">,
											model: modelId,
											tokensUsed: tokenData.total,
											inputTokens: tokenData.prompt,
											outputTokens: tokenData.completion,
											thinkingTokens: tokenData.thinking || 0,
											failureReason:
												usageError instanceof Error
													? usageError.message
													: String(usageError),
										},
									);
								}

								// Update last accessed time
								await convexClient.mutation(
									api.conversations.updateLastAccessed,
									{
										conversationId: conversationId as Id<"conversations">,
									},
								);
								timer.mark("convex_mutation_end");

								logContext.convex_mutation_duration_ms = timer.duration(
									"convex_mutation_start",
									"convex_mutation_end",
								);
								logContext.duration_ms = timer.elapsed();
								logContext.status = "success";
								logContext.node_id = newNodeId;

								// Emit wide event log
								logger.logChatRequest(logContext as ChatRequestLog);
							} catch (error) {
								logContext.status = "error";
								logContext.duration_ms = timer.elapsed();
								logContext.error_type =
									error instanceof Error ? error.name : "Unknown";
								logContext.error_message =
									error instanceof Error ? error.message : String(error);
								logContext.error_stack =
									error instanceof Error ? error.stack : undefined;

								logger.logChatRequest(logContext as ChatRequestLog);
							}
						},
					});

					timer.mark("model_ttfb");
					logContext.model_ttfb_ms = timer.duration(
						"model_request_start",
						"model_ttfb",
					);

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
						} catch (_e) {
							// Stream read errors are logged in onFinish
						} finally {
							reader.releaseLock();
						}
					})();

					// Return the client stream as a text/plain streaming response
					return new Response(clientStream, {
						headers: { "Content-Type": "text/plain; charset=utf-8" },
					});
				} catch (error) {
					logContext.status = "error";
					logContext.duration_ms = timer.elapsed();
					logContext.error_type =
						error instanceof Error ? error.name : "Unknown";
					logContext.error_message =
						error instanceof Error ? error.message : String(error);
					logContext.error_stack =
						error instanceof Error ? error.stack : undefined;

					// Log the error with full context
					logger.logChatRequest(logContext as ChatRequestLog);

					return new Response(
						JSON.stringify({
							error: "Failed to process chat request",
							request_id: requestId,
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
