import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useDashboardStats(userId: string | null | undefined) {
	return useQuery(
		api.dashboard.getDashboardStats,
		userId ? { userId } : "skip",
	);
}

export function useSearchConversations(
	userId: string | null | undefined,
	searchQuery: string,
) {
	return useQuery(
		api.dashboard.searchConversations,
		userId && searchQuery.trim()
			? { userId, searchQuery: searchQuery.trim() }
			: "skip",
	);
}

export function useRecentConversations(
	userId: string | null | undefined,
	limit = 3,
) {
	return useQuery(
		api.dashboard.getRecentConversationsWithPreview,
		userId ? { userId, limit } : "skip",
	);
}
