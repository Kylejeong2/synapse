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
const MODEL_NAME = (import.meta.env.VITE_OPENAI_MODEL as
  | string
  | undefined) || "gpt-4o-mini";

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

                    // 3. Create the node immediately so the minimap updates in real-time
                    const depth = nodeId ? ancestors.length : 0;
                    const position = {
                        x: depth * 300,
                        y: Math.random() * 100,
                    };

                    const newNodeId = await convexClient.mutation(api.nodes.create, {
                        conversationId: conversationId as Id<"conversations">,
                        parentId: nodeId ? (nodeId as Id<"nodes">) : undefined,
                        userPrompt: prompt,
                        assistantResponse: "",
                        model: MODEL_NAME,
                        tokensUsed: 0,
                        depth,
                        position,
                    });

                    // If this is the first node in the conversation, set it as root immediately
                    if (!nodeId) {
                        await convexClient.mutation(api.conversations.updateRootNode, {
                            conversationId: conversationId as Id<"conversations">,
                            rootNodeId: newNodeId as Id<"nodes">,
                        });
                    }

                    // 4. Stream from the model (throttled updates to Convex for near-realtime UI)
                    const result = streamText({
                        model: openai(MODEL_NAME),
                        messages,
                        async onFinish({ text, usage }) {
                            try {
                                // Final patch with complete text and token usage
                                await convexClient.mutation(api.nodes.updateContent, {
                                    nodeId: newNodeId as Id<"nodes">,
                                    assistantResponse: text,
                                    tokensUsed: usage.totalTokens ?? -1,
                                    model: MODEL_NAME,
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
                            console.error("Error reading text stream for Convex patching:", e);
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
