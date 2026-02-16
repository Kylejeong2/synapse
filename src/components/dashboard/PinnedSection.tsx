import { Pin } from "lucide-react";
import { ConversationCard } from "./ConversationCard";

interface Conversation {
	_id: string;
	title: string;
	nodeCount: number;
	lastAccessedAt: number;
	isPinned?: boolean;
}

interface PinnedSectionProps {
	conversations: Conversation[];
	onConversationClick: (id: string) => void;
	onConversationDelete: (id: string, e: React.MouseEvent) => void;
	onTogglePin: (id: string) => void;
}

export function PinnedSection({
	conversations,
	onConversationClick,
	onConversationDelete,
	onTogglePin,
}: PinnedSectionProps) {
	if (conversations.length === 0) return null;

	return (
		<div className="mb-10">
			<div className="flex items-center gap-2 mb-4">
				<Pin className="h-3.5 w-3.5 text-[var(--db-accent)]" />
				<h2 className="text-sm font-medium text-[var(--db-text-tertiary)] uppercase tracking-wide">
					Pinned
				</h2>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
				{conversations.map((conv) => (
					<ConversationCard
						key={conv._id}
						id={conv._id}
						title={conv.title}
						nodeCount={conv.nodeCount}
						lastAccessedAt={conv.lastAccessedAt}
						isPinned={true}
						onClick={() => onConversationClick(conv._id)}
						onDelete={(e) => onConversationDelete(conv._id, e)}
						onTogglePin={() => onTogglePin(conv._id)}
						viewMode="grid"
					/>
				))}
			</div>
		</div>
	);
}
