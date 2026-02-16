import { ArrowRight, MessageSquare } from "lucide-react";
import { MODELS } from "@/lib/constants/models";

interface RecentConversation {
	_id: string;
	title: string;
	nodeCount: number;
	lastAccessedAt: number;
	lastMessagePreview: string | null;
	lastModel: string | null;
}

interface ContinueSectionProps {
	conversations: RecentConversation[] | undefined;
	onContinue: (id: string) => void;
}

function formatRelativeTime(timestamp: number) {
	const now = Date.now();
	const diff = now - timestamp;
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d ago`;
	if (hours > 0) return `${hours}h ago`;
	if (minutes > 0) return `${minutes}m ago`;
	return "just now";
}

function getModelDisplayName(modelId: string | null): string {
	if (!modelId) return "";
	const model = MODELS[modelId as keyof typeof MODELS];
	return model?.name ?? modelId;
}

export function ContinueSection({
	conversations,
	onContinue,
}: ContinueSectionProps) {
	if (!conversations || conversations.length === 0) return null;

	return (
		<div className="mb-10">
			<h2 className="text-sm font-medium text-[var(--db-text-tertiary)] uppercase tracking-wide mb-4">
				Continue where you left off
			</h2>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{conversations.map((conv) => (
					<button
						key={conv._id}
						type="button"
						onClick={() => onContinue(conv._id)}
						onKeyDown={(e) => e.key === "Enter" && onContinue(conv._id)}
						className="group relative rounded-lg bg-[var(--db-surface)]/80 border border-[var(--db-border)] p-5 cursor-pointer hover:border-[var(--db-accent-border)] hover:shadow-md transition-all duration-200 text-left"
					>
						<div className="flex items-start justify-between mb-3">
							<div className="h-9 w-9 rounded-lg bg-[var(--db-accent)]/15 flex items-center justify-center">
								<MessageSquare className="h-4 w-4 text-[var(--db-accent)]" />
							</div>
							<span className="text-xs text-[var(--db-text-tertiary)]">
								{formatRelativeTime(conv.lastAccessedAt)}
							</span>
						</div>
						<h3 className="text-sm font-medium text-[var(--db-text)] line-clamp-1 mb-2">
							{conv.title}
						</h3>
						{conv.lastMessagePreview && (
							<p className="text-xs text-[var(--db-text-tertiary)] line-clamp-2 mb-3 leading-relaxed">
								{conv.lastMessagePreview}
							</p>
						)}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<span className="text-xs px-1.5 py-0.5 rounded bg-[var(--db-border)] text-[var(--db-text-tertiary)]">
									{conv.nodeCount} nodes
								</span>
								{conv.lastModel && (
									<span className="text-xs text-[var(--db-text-tertiary)]">
										{getModelDisplayName(conv.lastModel)}
									</span>
								)}
							</div>
							<div className="flex items-center gap-1 text-xs text-[var(--db-accent)] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
								Continue
								<ArrowRight className="h-3 w-3" />
							</div>
						</div>
					</button>
				))}
			</div>
		</div>
	);
}
