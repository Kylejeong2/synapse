import { openai } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Convex HTTP client for server-side database operations
 */
const convexClient = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL!);

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
					console.log("Received body:", JSON.stringify(body, null, 2));
					const { messages: incomingMessages, nodeId, conversationId } = body;
					console.log(
						"Extracted - conversationId:",
						conversationId,
						"nodeId:",
						nodeId,
					);

					// Extract the latest user message
					const lastMessage = incomingMessages[incomingMessages.length - 1];
					const prompt = lastMessage.parts
						.map((p: any) => p.text || "")
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

					// 3. Stream from OpenAI
					const result = streamText({
						model: openai("gpt-5-mini-2025-08-07"), // gpt-5-pro-2025-10-06
						messages,
						async onFinish({ text, usage }) {
							// 4. Save to Convex after streaming completes
							try {
								// Calculate depth
								const depth = nodeId ? ancestors.length : 0;

								// Calculate position (simple layout)
								const position = {
									x: depth * 300,
									y: Math.random() * 100, // Will be properly laid out by dagre later
								};

								const newNodeId = await convexClient.mutation(
									api.nodes.create,
									{
										conversationId: conversationId as Id<"conversations">,
										parentId: nodeId ? (nodeId as Id<"nodes">) : undefined,
										userPrompt: prompt,
										assistantResponse: text,
										model: "gpt-4o",
										tokensUsed: usage.totalTokens ?? -1, // so we know if this is failing TODO: fix this
										depth,
										position,
									},
								);

								// Update conversation's root node if this is the first node
								if (!nodeId) {
									await convexClient.mutation(
										api.conversations.updateRootNode,
										{
											conversationId: conversationId as Id<"conversations">,
											rootNodeId: newNodeId as Id<"nodes">,
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
							} catch (error) {
								console.error("Error saving to Convex:", error);
							}
						},
					});

					return result.toTextStreamResponse();
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
