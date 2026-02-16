import { Brain, GitFork, MessageSquare, Zap } from "lucide-react";
import { MODELS } from "@/lib/constants/models";

interface StatsBarProps {
	stats: {
		totalConversations: number;
		totalNodes: number;
		totalTokens: number;
		mostUsedModel: string | null;
	} | undefined;
}

function formatTokenCount(tokens: number): string {
	if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
	if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
	return String(tokens);
}

function getModelDisplayName(modelId: string | null): string {
	if (!modelId) return "—";
	const model = MODELS[modelId as keyof typeof MODELS];
	return model?.name ?? modelId;
}

const STAT_ITEMS = [
	{
		key: "conversations",
		label: "Conversations",
		icon: MessageSquare,
		getValue: (s: StatsBarProps["stats"]) => String(s?.totalConversations ?? 0),
	},
	{
		key: "nodes",
		label: "Total Branches",
		icon: GitFork,
		getValue: (s: StatsBarProps["stats"]) => String(s?.totalNodes ?? 0),
	},
	{
		key: "tokens",
		label: "Tokens Used",
		icon: Zap,
		getValue: (s: StatsBarProps["stats"]) =>
			formatTokenCount(s?.totalTokens ?? 0),
	},
	{
		key: "model",
		label: "Most Used Model",
		icon: Brain,
		getValue: (s: StatsBarProps["stats"]) =>
			getModelDisplayName(s?.mostUsedModel ?? null),
	},
] as const;

export function StatsBar({ stats }: StatsBarProps) {
	return (
		<div className="mb-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
			{STAT_ITEMS.map((item) => (
				<div
					key={item.key}
					className="flex items-center gap-3 px-5 py-4 rounded-lg bg-[var(--db-surface)]/80 border border-[var(--db-border)] backdrop-blur-sm"
				>
					<div className="h-9 w-9 rounded-lg bg-[var(--db-accent-light)] flex items-center justify-center shrink-0">
						<item.icon className="h-4 w-4 text-[var(--db-accent)]" />
					</div>
					<div className="min-w-0">
						<p className="text-xl font-semibold text-[var(--db-text)] tracking-tight truncate">
							{item.getValue(stats)}
						</p>
						<p className="text-xs text-[var(--db-text-tertiary)]">
							{item.label}
						</p>
					</div>
				</div>
			))}
		</div>
	);
}
