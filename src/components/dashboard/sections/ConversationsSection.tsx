import { useUser } from "@clerk/clerk-react";
import { useMemo, useState } from "react";
import { useSearchConversations } from "@/hooks/useDashboard";
import { BulkActionToolbar } from "../BulkActionToolbar";
import { ConversationGrid } from "../ConversationGrid";
import { EmptyState } from "../EmptyState";
import { PinnedSection } from "../PinnedSection";
import {
	QuickActionsBar,
	type SortBy,
	type ViewMode,
} from "../QuickActionsBar";
import { TagFilter } from "../TagFilter";

interface Conversation {
	_id: string;
	_creationTime: number;
	title: string;
	nodeCount: number;
	lastAccessedAt: number;
	isPinned?: boolean;
	tags?: string[];
	defaultModel?: string;
}

interface ConversationsSectionProps {
	conversations: Conversation[] | undefined;
	onConversationClick: (id: string) => void;
	onConversationDelete: (id: string, e: React.MouseEvent) => void;
	onTogglePin: (id: string) => void;
	onUpdateTags: (id: string, tags: string[]) => void;
	onNewConversation: () => void;
	searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function ConversationsSection({
	conversations,
	onConversationClick,
	onConversationDelete,
	onTogglePin,
	onUpdateTags,
	onNewConversation,
	searchInputRef,
}: ConversationsSectionProps) {
	const { user } = useUser();
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState<SortBy>("lastAccessed");
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [tagFilter, setTagFilter] = useState<string[]>([]);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	// Server-side full-text search (searches titles + message content)
	const searchResults = useSearchConversations(user?.id, searchQuery);

	const allTags = useMemo(() => {
		if (!conversations) return [];
		const tagSet = new Set<string>();
		for (const c of conversations) {
			for (const tag of c.tags ?? []) {
				tagSet.add(tag);
			}
		}
		return Array.from(tagSet).sort();
	}, [conversations]);

	const handleTagToggle = (tag: string) => {
		setTagFilter((prev) =>
			prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
		);
	};

	const isSearching = searchQuery.trim().length > 0;

	const { pinned, unpinned } = useMemo(() => {
		// Use search results when searching, otherwise use all conversations
		const source = isSearching ? searchResults : conversations;
		if (!source) return { pinned: [], unpinned: [] };

		let result = [...source] as Conversation[];

		if (tagFilter.length > 0) {
			result = result.filter((c) =>
				tagFilter.every((tag) => c.tags?.includes(tag)),
			);
		}

		// Don't re-sort search results (they're ranked by relevance)
		if (!isSearching) {
			result.sort((a, b) => {
				switch (sortBy) {
					case "lastAccessed":
						return b.lastAccessedAt - a.lastAccessedAt;
					case "created":
						return b._creationTime - a._creationTime;
					case "nodeCount":
						return b.nodeCount - a.nodeCount;
					case "alphabetical":
						return a.title.localeCompare(b.title);
					default:
						return 0;
				}
			});
		}

		return {
			pinned: result.filter((c) => c.isPinned),
			unpinned: result.filter((c) => !c.isPinned),
		};
	}, [conversations, searchResults, isSearching, sortBy, tagFilter]);

	const allVisible = [...pinned, ...unpinned];
	const hasConversations = conversations && conversations.length > 0;
	const hasResults = pinned.length > 0 || unpinned.length > 0;
	const hasActiveFilters = isSearching || tagFilter.length > 0;

	const handleToggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const handleDeleteSelected = async () => {
		for (const id of selectedIds) {
			onConversationDelete(id, { stopPropagation: () => {} } as React.MouseEvent);
		}
		setSelectedIds(new Set());
	};

	if (!hasConversations) {
		return (
			<div>
				<h1 className="text-2xl font-semibold tracking-tight text-[var(--db-text)] mb-8">
					All Conversations
				</h1>
				<EmptyState onNewConversation={onNewConversation} />
			</div>
		);
	}

	return (
		<div>
			<h1 className="text-2xl font-semibold tracking-tight text-[var(--db-text)] mb-6">
				All Conversations
			</h1>

			<QuickActionsBar
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				sortBy={sortBy}
				onSortChange={setSortBy}
				viewMode={viewMode}
				onViewModeChange={setViewMode}
				searchInputRef={searchInputRef}
			/>

			{isSearching && searchResults && (
				<p className="text-sm text-[var(--db-text-tertiary)] mb-4">
					{allVisible.length} result{allVisible.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
				</p>
			)}

			{allTags.length > 0 && (
				<TagFilter
					availableTags={allTags}
					selectedTags={tagFilter}
					onTagToggle={handleTagToggle}
					onClearTags={() => setTagFilter([])}
				/>
			)}

			{hasResults ? (
				<>
					{!isSearching && (
						<PinnedSection
							conversations={pinned}
							onConversationClick={onConversationClick}
							onConversationDelete={onConversationDelete}
							onTogglePin={onTogglePin}
						/>
					)}

					{!isSearching && unpinned.length > 0 && pinned.length > 0 && (
						<h2 className="text-sm font-medium text-[var(--db-text-tertiary)] uppercase tracking-wide mb-4">
							All Conversations
						</h2>
					)}

					<ConversationGrid
						conversations={isSearching ? allVisible : unpinned}
						viewMode={viewMode}
						selectedIds={selectedIds}
						onConversationClick={onConversationClick}
						onConversationDelete={onConversationDelete}
						onTogglePin={onTogglePin}
						onUpdateTags={onUpdateTags}
						onToggleSelect={handleToggleSelect}
					/>
				</>
			) : hasActiveFilters ? (
				<div className="text-center py-16">
					<p className="text-[var(--db-text-secondary)]">
						No conversations match your search
					</p>
				</div>
			) : null}

			<BulkActionToolbar
				selectedCount={selectedIds.size}
				totalCount={allVisible.length}
				onSelectAll={() =>
					setSelectedIds(new Set(allVisible.map((c) => c._id)))
				}
				onClearSelection={() => setSelectedIds(new Set())}
				onDeleteSelected={handleDeleteSelected}
			/>
		</div>
	);
}
