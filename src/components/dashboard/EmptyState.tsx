import { MessageSquare, Plus } from "lucide-react";

interface EmptyStateProps {
	onNewConversation: () => void;
}

export function EmptyState({ onNewConversation }: EmptyStateProps) {
	return (
		<div className="text-center py-24">
			<div className="inline-flex h-16 w-16 rounded-xl border-2 border-dashed border-[var(--db-muted-border)] items-center justify-center mb-6">
				<MessageSquare className="h-8 w-8 text-[var(--db-text-tertiary)] opacity-60" />
			</div>
			<p className="text-lg font-medium text-[var(--db-text-secondary)] mb-2">
				No conversations yet
			</p>
			<p className="text-sm text-[var(--db-text-tertiary)] mb-6">
				Start your first branching conversation with AI
			</p>
			<button
				type="button"
				onClick={onNewConversation}
				className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[var(--db-dark-bg)] text-[var(--db-text-on-dark)] text-sm font-medium hover:bg-[var(--db-dark-surface)] transition-all duration-200"
			>
				<Plus className="h-4 w-4" />
				New Conversation
			</button>
		</div>
	);
}
