import { v } from "convex/values";
import { query } from "./_generated/server";
import { ConvexTimer, generateOperationId, logConvexOperation } from "./logger";

export const getDashboardStats = query({
	args: {
		userId: v.string(),
		requestId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const operationId = generateOperationId();
		const timer = new ConvexTimer();

		try {
			const { userId } = args;

			const conversations = await ctx.db
				.query("conversations")
				.withIndex("userId", (q) => q.eq("userId", userId))
				.collect();

			let totalNodes = 0;
			let totalTokens = 0;
			const modelCounts: Record<string, number> = {};

			for (const conv of conversations) {
				const nodes = await ctx.db
					.query("nodes")
					.withIndex("conversationId", (q) =>
						q.eq("conversationId", conv._id),
					)
					.collect();

				totalNodes += nodes.length;

				for (const node of nodes) {
					totalTokens += node.tokensUsed || 0;
					if (node.model) {
						modelCounts[node.model] = (modelCounts[node.model] || 0) + 1;
					}
				}
			}

			let mostUsedModel: string | null = null;
			let maxCount = 0;
			for (const [model, count] of Object.entries(modelCounts)) {
				if (count > maxCount) {
					maxCount = count;
					mostUsedModel = model;
				}
			}

			const result = {
				totalConversations: conversations.length,
				totalNodes,
				totalTokens,
				mostUsedModel,
			};

			logConvexOperation({
				operation_id: operationId,
				request_id: args.requestId,
				operation_type: "query",
				operation_name: "dashboard.getDashboardStats",
				timestamp: Date.now(),
				duration_ms: timer.elapsed(),
				user_id: userId,
				status: "success",
				service_name: "synapse-convex",
				environment: process.env.NODE_ENV || "development",
			});

			return result;
		} catch (error) {
			logConvexOperation({
				operation_id: operationId,
				request_id: args.requestId,
				operation_type: "query",
				operation_name: "dashboard.getDashboardStats",
				timestamp: Date.now(),
				duration_ms: timer.elapsed(),
				user_id: args.userId,
				status: "error",
				error_type: error instanceof Error ? error.name : "Unknown",
				error_message: error instanceof Error ? error.message : String(error),
				service_name: "synapse-convex",
				environment: process.env.NODE_ENV || "development",
			});
			throw error;
		}
	},
});

export const getRecentConversationsWithPreview = query({
	args: {
		userId: v.string(),
		limit: v.number(),
		requestId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const operationId = generateOperationId();
		const timer = new ConvexTimer();

		try {
			const { userId, limit } = args;

			const conversations = await ctx.db
				.query("conversations")
				.withIndex("userId", (q) => q.eq("userId", userId))
				.collect();

			const recent = conversations
				.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
				.slice(0, limit);

			const result = await Promise.all(
				recent.map(async (conv) => {
					const nodes = await ctx.db
						.query("nodes")
						.withIndex("conversationId", (q) =>
							q.eq("conversationId", conv._id),
						)
						.collect();

					const latestNode = nodes.sort(
						(a, b) => b._creationTime - a._creationTime,
					)[0];

					const preview = latestNode?.assistantResponse
						? latestNode.assistantResponse.slice(0, 150)
						: null;

					return {
						...conv,
						nodeCount: nodes.length,
						lastMessagePreview: preview,
						lastModel: latestNode?.model ?? null,
					};
				}),
			);

			logConvexOperation({
				operation_id: operationId,
				request_id: args.requestId,
				operation_type: "query",
				operation_name: "dashboard.getRecentConversationsWithPreview",
				timestamp: Date.now(),
				duration_ms: timer.elapsed(),
				user_id: userId,
				status: "success",
				records_affected: result.length,
				service_name: "synapse-convex",
				environment: process.env.NODE_ENV || "development",
			});

			return result;
		} catch (error) {
			logConvexOperation({
				operation_id: operationId,
				request_id: args.requestId,
				operation_type: "query",
				operation_name: "dashboard.getRecentConversationsWithPreview",
				timestamp: Date.now(),
				duration_ms: timer.elapsed(),
				user_id: args.userId,
				status: "error",
				error_type: error instanceof Error ? error.name : "Unknown",
				error_message: error instanceof Error ? error.message : String(error),
				service_name: "synapse-convex",
				environment: process.env.NODE_ENV || "development",
			});
			throw error;
		}
	},
});

export const searchConversations = query({
	args: {
		userId: v.string(),
		searchQuery: v.string(),
	},
	handler: async (ctx, args) => {
		const { userId, searchQuery } = args;

		// Search conversation titles
		const titleMatches = await ctx.db
			.query("conversations")
			.withSearchIndex("search_title", (q) =>
				q.search("title", searchQuery).eq("userId", userId),
			)
			.take(20);

		const matchedIds = new Set(titleMatches.map((c) => c._id));

		// Search node content (user prompts)
		const nodeMatches = await ctx.db
			.query("nodes")
			.withSearchIndex("search_content", (q) =>
				q.search("userPrompt", searchQuery),
			)
			.take(50);

		// Get unique conversation IDs from node matches
		for (const node of nodeMatches) {
			matchedIds.add(node.conversationId);
		}

		// Fetch full conversations for node-matched ones (that weren't already in title matches)
		const titleMatchIds = new Set(titleMatches.map((c) => c._id));
		const additionalConvIds = [...matchedIds].filter(
			(id) => !titleMatchIds.has(id),
		);

		const additionalConvs = await Promise.all(
			additionalConvIds.map((id) => ctx.db.get(id)),
		);

		// Filter to only this user's conversations
		const validAdditional = additionalConvs.filter(
			(c) => c && c.userId === userId,
		);

		// Combine: title matches first (higher relevance), then content matches
		const allConvs = [...titleMatches, ...validAdditional];

		// Get node counts
		const result = await Promise.all(
			allConvs.map(async (conv) => {
				if (!conv) return null;
				const nodes = await ctx.db
					.query("nodes")
					.withIndex("conversationId", (q) =>
						q.eq("conversationId", conv._id),
					)
					.collect();
				return {
					...conv,
					nodeCount: nodes.length,
				};
			}),
		);

		return result.filter((c) => c !== null);
	},
});

export const getConversationTreeStructure = query({
	args: {
		conversationId: v.id("conversations"),
		requestId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const operationId = generateOperationId();
		const timer = new ConvexTimer();

		try {
			const { conversationId } = args;

			const nodes = await ctx.db
				.query("nodes")
				.withIndex("conversationId", (q) =>
					q.eq("conversationId", conversationId),
				)
				.collect();

			const result = nodes.map((node) => ({
				_id: node._id,
				parentId: node.parentId ?? undefined,
				depth: node.depth,
			}));

			logConvexOperation({
				operation_id: operationId,
				request_id: args.requestId,
				operation_type: "query",
				operation_name: "dashboard.getConversationTreeStructure",
				timestamp: Date.now(),
				duration_ms: timer.elapsed(),
				conversation_id: conversationId,
				status: "success",
				records_affected: result.length,
				service_name: "synapse-convex",
				environment: process.env.NODE_ENV || "development",
			});

			return result;
		} catch (error) {
			logConvexOperation({
				operation_id: operationId,
				request_id: args.requestId,
				operation_type: "query",
				operation_name: "dashboard.getConversationTreeStructure",
				timestamp: Date.now(),
				duration_ms: timer.elapsed(),
				conversation_id: args.conversationId,
				status: "error",
				error_type: error instanceof Error ? error.name : "Unknown",
				error_message: error instanceof Error ? error.message : String(error),
				service_name: "synapse-convex",
				environment: process.env.NODE_ENV || "development",
			});
			throw error;
		}
	},
});
