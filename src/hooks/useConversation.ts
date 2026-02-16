/**
 * Convex hooks for conversation and node management.
 * Provides reactive queries and mutations for the chat tree data model.
 */
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

/** Fetches all conversations for a user, sorted by last accessed. Skips query if userId is null/undefined. */
export function useConversations(userId: string | null | undefined) {
	return useQuery(
		api.conversations.getUserConversations,
		userId ? { userId } : "skip",
	);
}

/** Fetches a single conversation by ID. Skips query if conversationId is null. */
export function useConversation(conversationId: Id<"conversations"> | null) {
	return useQuery(
		api.conversations.getConversation,
		conversationId ? { conversationId } : "skip",
	);
}

/** Returns mutation to create a new conversation with initial system node. */
export function useCreateConversation() {
	return useMutation(api.conversations.create);
}

/** Returns mutation to update a conversation's lastAccessedAt timestamp. */
export function useUpdateLastAccessed() {
	return useMutation(api.conversations.updateLastAccessed);
}

/** Returns mutation to delete a conversation and all its nodes. */
export function useDeleteConversation() {
	return useMutation(api.conversations.deleteConversation);
}

/** Returns mutation to update the active root node for a conversation (used for branching). */
export function useUpdateRootNode() {
	return useMutation(api.conversations.updateRootNode);
}

/** Returns mutation to update the default AI model for a conversation. */
export function useUpdateDefaultModel() {
	return useMutation(api.conversations.updateDefaultModel);
}

/** Returns mutation to toggle pin status on a conversation. */
export function useTogglePin() {
	return useMutation(api.conversations.togglePin);
}

/** Returns mutation to update tags on a conversation. */
export function useUpdateTags() {
	return useMutation(api.conversations.updateTags);
}

/** Returns mutation to create a new message node in the conversation tree. */
export function useCreateNode() {
	return useMutation(api.nodes.create);
}

/** Fetches all ancestor nodes from a given node up to the root. Used to build conversation context. */
export function useNodeAncestors(nodeId: Id<"nodes"> | null | undefined) {
	return useQuery(api.nodes.getAncestors, nodeId ? { nodeId } : "skip");
}

/** Fetches the context chain (messages) for a node. Returns messages in chronological order. */
export function useContextChain(nodeId: Id<"nodes"> | null) {
	return useQuery(api.nodes.getContextChain, nodeId ? { nodeId } : "skip");
}

/** Returns mutation to update a node's x/y position in the tree visualization. */
export function useUpdateNodePosition() {
	return useMutation(api.nodes.updatePosition);
}
