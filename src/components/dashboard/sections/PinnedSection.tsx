import { Pin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ConversationGrid } from "../ConversationGrid";

interface Conversation {
	_id: string;
	title: string;
	nodeCount: number;
	lastAccessedAt: number;
	isPinned?: boolean;
	tags?: string[];
}

interface PinnedSectionPageProps {
	conversations: Conversation[] | undefined;
	onConversationClick: (id: string) => void;
	onConversationDelete: (id: string, e: React.MouseEvent) => void;
	onTogglePin: (id: string) => void;
	onUpdateTags: (id: string, tags: string[]) => void;
}

export function PinnedSectionPage({
	conversations,
	onConversationClick,
	onConversationDelete,
	onTogglePin,
	onUpdateTags,
}: PinnedSectionPageProps) {
	const [searchQuery, setSearchQuery] = useState("");

	const pinnedConversations = useMemo(() => {
		if (!conversations) return [];
		let result = conversations.filter((c) => c.isPinned);
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter((c) => c.title.toLowerCase().includes(query));
		}
		return result;
	}, [conversations, searchQuery]);

	return (
		<div>
			<div className="flex items-center gap-3 mb-6">
				<Pin className="h-5 w-5 text-[var(--db-accent)]" />
				<h1 className="text-2xl font-semibold tracking-tight text-[var(--db-text)]">
					Pinned Conversations
				</h1>
			</div>

			{pinnedConversations.length > 0 || searchQuery ? (
				<>
					<div className="relative mb-6 max-w-md">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--db-text-tertiary)]" />
						<input
							type="text"
							placeholder="Search pinned..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-10 pr-4 py-2.5 rounded-md bg-[var(--db-subtle)] border border-[var(--db-border)] text-[var(--db-text)] placeholder:text-[var(--db-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--db-accent-border)] focus:border-[var(--db-accent-border)] transition-all text-sm"
						/>
					</div>

					{pinnedConversations.length > 0 ? (
						<ConversationGrid
							conversations={pinnedConversations}
							viewMode="grid"
							onConversationClick={onConversationClick}
							onConversationDelete={onConversationDelete}
							onTogglePin={onTogglePin}
							onUpdateTags={onUpdateTags}
						/>
					) : (
						<div className="text-center py-16">
							<p className="text-[var(--db-text-secondary)]">
								No pinned conversations match your search
							</p>
						</div>
					)}
				</>
			) : (
				<div className="text-center py-20">
					<div className="inline-flex h-14 w-14 rounded-xl border-2 border-dashed border-[var(--db-muted-border)] items-center justify-center mb-5">
						<Pin className="h-6 w-6 text-[var(--db-text-tertiary)] opacity-60" />
					</div>
					<p className="text-base font-medium text-[var(--db-text-secondary)] mb-2">
						No pinned conversations yet
					</p>
					<p className="text-sm text-[var(--db-text-tertiary)]">
						Pin conversations from the Conversations view to access them quickly
					</p>
				</div>
			)}
		</div>
	);
}
