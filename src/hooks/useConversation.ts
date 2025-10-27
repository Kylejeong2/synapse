import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function useConversations(userId: string | null | undefined) {
	return useQuery(
		api.conversations.getUserConversations,
		userId ? { userId } : "skip",
	);
}

export function useConversation(conversationId: Id<"conversations"> | null) {
	return useQuery(
		api.conversations.getConversation,
		conversationId ? { conversationId } : "skip",
	);
}

export function useCreateConversation() {
	return useMutation(api.conversations.create);
}

export function useUpdateLastAccessed() {
	return useMutation(api.conversations.updateLastAccessed);
}

export function useDeleteConversation() {
	return useMutation(api.conversations.deleteConversation);
}

export function useUpdateRootNode() {
	return useMutation(api.conversations.updateRootNode);
}

export function useCreateNode() {
	return useMutation(api.nodes.create);
}

export function useNodeAncestors(nodeId: Id<"nodes"> | null | undefined) {
	return useQuery(api.nodes.getAncestors, nodeId ? { nodeId } : "skip");
}

export function useContextChain(nodeId: Id<"nodes"> | null) {
	return useQuery(api.nodes.getContextChain, nodeId ? { nodeId } : "skip");
}

export function useUpdateNodePosition() {
	return useMutation(api.nodes.updatePosition);
}
