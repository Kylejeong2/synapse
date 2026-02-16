import { ContinueSection } from "../ContinueSection";
import { EmptyState } from "../EmptyState";
import { StatsBar } from "../StatsBar";

interface OverviewSectionProps {
	stats:
		| {
				totalConversations: number;
				totalNodes: number;
				totalTokens: number;
				mostUsedModel: string | null;
		  }
		| undefined;
	recentConversations:
		| {
				_id: string;
				title: string;
				nodeCount: number;
				lastAccessedAt: number;
				lastMessagePreview: string | null;
				lastModel: string | null;
		  }[]
		| undefined;
	hasConversations: boolean;
	conversationCount: number;
	onContinue: (id: string) => void;
	onNewConversation: () => void;
}

export function OverviewSection({
	stats,
	recentConversations,
	hasConversations,
	conversationCount,
	onContinue,
	onNewConversation,
}: OverviewSectionProps) {
	return (
		<div>
			<div className="mb-10">
				<h1 className="text-3xl font-semibold tracking-tight text-[var(--db-text)]">
					Welcome back
				</h1>
				<p className="mt-2 text-base text-[var(--db-text-secondary)]">
					{conversationCount > 0
						? `${conversationCount} conversation${conversationCount !== 1 ? "s" : ""} — branch, explore, and compare AI responses`
						: "Create branching conversations and explore ideas with AI"}
				</p>
			</div>

			{hasConversations ? (
				<>
					<StatsBar stats={stats} />
					<ContinueSection
						conversations={recentConversations}
						onContinue={onContinue}
					/>
				</>
			) : (
				<EmptyState onNewConversation={onNewConversation} />
			)}
		</div>
	);
}
