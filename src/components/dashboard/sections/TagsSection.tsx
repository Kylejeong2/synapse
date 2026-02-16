import { MessageSquare, Tag } from "lucide-react";
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

interface TagsSectionProps {
	conversations: Conversation[] | undefined;
	onConversationClick: (id: string) => void;
	onConversationDelete: (id: string, e: React.MouseEvent) => void;
	onTogglePin: (id: string) => void;
	onUpdateTags: (id: string, tags: string[]) => void;
}

export function TagsSection({
	conversations,
	onConversationClick,
	onConversationDelete,
	onTogglePin,
	onUpdateTags,
}: TagsSectionProps) {
	const [selectedTags, setSelectedTags] = useState<string[]>([]);

	const { tagCounts, allTags } = useMemo(() => {
		if (!conversations)
			return { tagCounts: new Map<string, number>(), allTags: [] };
		const counts = new Map<string, number>();
		for (const c of conversations) {
			for (const tag of c.tags ?? []) {
				counts.set(tag, (counts.get(tag) ?? 0) + 1);
			}
		}
		return {
			tagCounts: counts,
			allTags: Array.from(counts.keys()).sort(),
		};
	}, [conversations]);

	const filteredConversations = useMemo(() => {
		if (!conversations || selectedTags.length === 0) return [];
		return conversations.filter((c) =>
			selectedTags.every((tag) => c.tags?.includes(tag)),
		);
	}, [conversations, selectedTags]);

	const handleTagToggle = (tag: string) => {
		setSelectedTags((prev) =>
			prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
		);
	};

	if (allTags.length === 0) {
		return (
			<div>
				<div className="flex items-center gap-3 mb-6">
					<Tag className="h-5 w-5 text-[var(--db-accent)]" />
					<h1 className="text-2xl font-semibold tracking-tight text-[var(--db-text)]">
						Tags
					</h1>
				</div>
				<div className="text-center py-20">
					<div className="inline-flex h-14 w-14 rounded-xl border-2 border-dashed border-[var(--db-muted-border)] items-center justify-center mb-5">
						<Tag className="h-6 w-6 text-[var(--db-text-tertiary)] opacity-60" />
					</div>
					<p className="text-base font-medium text-[var(--db-text-secondary)] mb-2">
						No tags yet
					</p>
					<p className="text-sm text-[var(--db-text-tertiary)]">
						Add tags to conversations from the Conversations view to organize
						them
					</p>
				</div>
			</div>
		);
	}

	return (
		<div>
			<div className="flex items-center gap-3 mb-6">
				<Tag className="h-5 w-5 text-[var(--db-accent)]" />
				<h1 className="text-2xl font-semibold tracking-tight text-[var(--db-text)]">
					Tags
				</h1>
			</div>

			{/* Tag cards */}
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
				{allTags.map((tag) => {
					const isSelected = selectedTags.includes(tag);
					const count = tagCounts.get(tag) ?? 0;
					return (
						<button
							key={tag}
							type="button"
							onClick={() => handleTagToggle(tag)}
							className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all duration-150 ${
								isSelected
									? "bg-[var(--db-accent-light)] border-[var(--db-accent-border)] shadow-sm"
									: "bg-[var(--db-surface)]/60 border-[var(--db-border)] hover:border-[var(--db-accent-border)]"
							}`}
						>
							<Tag
								className={`h-3.5 w-3.5 shrink-0 ${
									isSelected
										? "text-[var(--db-accent)]"
										: "text-[var(--db-text-tertiary)]"
								}`}
							/>
							<div className="min-w-0 flex-1">
								<p
									className={`text-sm font-medium truncate ${
										isSelected
											? "text-[var(--db-accent)]"
											: "text-[var(--db-text)]"
									}`}
								>
									{tag}
								</p>
								<p className="text-xs text-[var(--db-text-tertiary)]">
									{count} conversation{count !== 1 ? "s" : ""}
								</p>
							</div>
						</button>
					);
				})}
			</div>

			{/* Selected tags indicator */}
			{selectedTags.length > 0 && (
				<div className="flex items-center gap-2 mb-6">
					<span className="text-sm text-[var(--db-text-secondary)]">
						Showing conversations tagged:
					</span>
					{selectedTags.map((tag) => (
						<span
							key={tag}
							className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--db-accent)] text-[var(--db-text-on-dark)] text-xs font-medium"
						>
							{tag}
								<button
									type="button"
									onClick={() => handleTagToggle(tag)}
									className="hover:bg-[var(--db-on-dark-overlay)] rounded-full p-0.5 transition-colors"
								>
									<span className="sr-only">Remove</span>
									<svg className="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
										<title>Remove tag</title>
										<path
											d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5"
											stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
									/>
								</svg>
							</button>
						</span>
					))}
					<button
						type="button"
						onClick={() => setSelectedTags([])}
						className="text-xs text-[var(--db-accent)] hover:text-[var(--db-accent-hover)] font-medium transition-colors"
					>
						Clear all
					</button>
				</div>
			)}

			{/* Filtered conversations */}
			{selectedTags.length > 0 && (
				filteredConversations.length > 0 ? (
					<ConversationGrid
						conversations={filteredConversations}
						viewMode="grid"
						onConversationClick={onConversationClick}
						onConversationDelete={onConversationDelete}
						onTogglePin={onTogglePin}
						onUpdateTags={onUpdateTags}
					/>
				) : (
					<div className="text-center py-12">
						<MessageSquare className="h-8 w-8 text-[var(--db-text-tertiary)] opacity-40 mx-auto mb-3" />
						<p className="text-[var(--db-text-secondary)]">
							No conversations match the selected tags
						</p>
					</div>
				)
			)}
		</div>
	);
}
