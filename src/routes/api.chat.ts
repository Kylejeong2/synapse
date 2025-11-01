import { openai } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SYSTEM_PROMPT } from "../lib/constants";

/**
 * Convex HTTP client for server-side database operations
 */
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "";
if (!CONVEX_URL) {
	throw new Error("VITE_CONVEX_URL environment variable is not set");
}
const convexClient = new ConvexHttpClient(CONVEX_URL);
const MODEL_NAME =
	(import.meta.env.VITE_OPENAI_MODEL as string | undefined) || "gpt-4o-mini";

/**
 * API route for handling chat requests with streaming responses
 * Fetches conversation context, streams OpenAI responses, and saves to database
 */
export const Route = createFileRoute("/api/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const body = await request.json();
					const { messages: incomingMessages, nodeId, conversationId } = body;

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
					// Note: OpenAI's native tools (web search, Python, image gen) are available through
					// the responses API which is used by default for gpt-4o/gpt-5 models in AI SDK v5+
					let newNodeId: Id<"nodes">;

					// Start OpenAI and node creation in parallel
					const openaiPromise = streamText({
						model: openai(MODEL_NAME),
						system: SYSTEM_PROMPT,
						messages,
						maxOutputTokens: 4096,
						temperature: 0.7,
						async onFinish({ text, usage, response }) {
							try {
								// Extract tool data from response if available
								const responseData = response as unknown as {
									toolCalls?: unknown[];
									toolResults?: unknown[];
								};
								const toolCalls = responseData.toolCalls || undefined;
								const toolResults = responseData.toolResults || undefined;

								// Final patch with complete text, token usage, and tool data
								await convexClient.mutation(api.nodes.updateContent, {
									nodeId: newNodeId as Id<"nodes">,
									assistantResponse: text,
									tokensUsed: usage.totalTokens ?? -1,
									model: MODEL_NAME,
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
								console.error("Error updating Convex:", error);
							}
						},
					});

					// Create node and set root in parallel with OpenAI
					const nodePromise = convexClient
						.mutation(api.nodes.create, {
							conversationId: conversationId as Id<"conversations">,
							parentId: nodeId ? (nodeId as Id<"nodes">) : undefined,
							userPrompt: prompt,
							assistantResponse: "",
							model: MODEL_NAME,
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

					// Wait for both OpenAI and node creation
					const [result, _newNodeId] = await Promise.all([
						openaiPromise,
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
											model: MODEL_NAME,
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
