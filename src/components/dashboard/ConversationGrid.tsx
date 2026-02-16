import { ConversationCard } from "./ConversationCard";
import type { ViewMode } from "./QuickActionsBar";

interface Conversation {
	_id: string;
	title: string;
	nodeCount: number;
	lastAccessedAt: number;
	isPinned?: boolean;
	tags?: string[];
}

interface ConversationGridProps {
	conversations: Conversation[];
	viewMode: ViewMode;
	selectedIds?: Set<string>;
	onConversationClick: (id: string) => void;
	onConversationDelete: (id: string, e: React.MouseEvent) => void;
	onTogglePin?: (id: string) => void;
	onUpdateTags?: (id: string, tags: string[]) => void;
	onToggleSelect?: (id: string) => void;
}

export function ConversationGrid({
	conversations,
	viewMode,
	selectedIds,
	onConversationClick,
	onConversationDelete,
	onTogglePin,
	onUpdateTags,
	onToggleSelect,
}: ConversationGridProps) {
	const hasSelection = selectedIds && selectedIds.size > 0;

	if (viewMode === "list") {
		return (
			<div className="flex flex-col gap-2">
				{conversations.map((conversation) => (
					<ConversationCard
						key={conversation._id}
						id={conversation._id}
						title={conversation.title}
						nodeCount={conversation.nodeCount}
						lastAccessedAt={conversation.lastAccessedAt}
						isPinned={conversation.isPinned}
						tags={conversation.tags}
						isSelected={selectedIds?.has(conversation._id)}
						showCheckbox={hasSelection}
						onClick={() => onConversationClick(conversation._id)}
						onDelete={(e) => onConversationDelete(conversation._id, e)}
						onTogglePin={
							onTogglePin ? () => onTogglePin(conversation._id) : undefined
						}
						onUpdateTags={
							onUpdateTags
								? (tags) => onUpdateTags(conversation._id, tags)
								: undefined
						}
						onToggleSelect={
							onToggleSelect
								? () => onToggleSelect(conversation._id)
								: undefined
						}
						viewMode={viewMode}
					/>
				))}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
			{conversations.map((conversation) => (
				<ConversationCard
					key={conversation._id}
					id={conversation._id}
					title={conversation.title}
					nodeCount={conversation.nodeCount}
					lastAccessedAt={conversation.lastAccessedAt}
					isPinned={conversation.isPinned}
					tags={conversation.tags}
					isSelected={selectedIds?.has(conversation._id)}
					showCheckbox={hasSelection}
					onClick={() => onConversationClick(conversation._id)}
					onDelete={(e) => onConversationDelete(conversation._id, e)}
					onTogglePin={
						onTogglePin ? () => onTogglePin(conversation._id) : undefined
					}
					onUpdateTags={
						onUpdateTags
							? (tags) => onUpdateTags(conversation._id, tags)
							: undefined
					}
					onToggleSelect={
						onToggleSelect ? () => onToggleSelect(conversation._id) : undefined
					}
					viewMode={viewMode}
				/>
			))}
		</div>
	);
}
