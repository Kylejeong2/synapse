import { MessageSquare, Pin, Tag, Trash2 } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ViewMode } from "./QuickActionsBar";
import { TagManager } from "./TagManager";
import { TreePreviewPopover } from "./TreePreviewPopover";

interface ConversationCardProps {
	id: string;
	title: string;
	nodeCount: number;
	lastAccessedAt: number;
	isPinned?: boolean;
	tags?: string[];
	isSelected?: boolean;
	showCheckbox?: boolean;
	onClick: () => void;
	onDelete: (e: React.MouseEvent) => void;
	onTogglePin?: () => void;
	onUpdateTags?: (tags: string[]) => void;
	onToggleSelect?: () => void;
	viewMode: ViewMode;
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

function DeleteDialog({ onDelete }: { onDelete: (e: React.MouseEvent) => void }) {
	return (
		<AlertDialog>
			<AlertDialogTrigger
				asChild
				onClick={(e) => e.stopPropagation()}
			>
				<button
					type="button"
					className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--db-surface)] transition-all"
				>
					<Trash2 className="h-3.5 w-3.5 text-red-500" />
				</button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete conversation?</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently delete this conversation and all its
						messages. This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={onDelete}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function PinButton({ isPinned, onTogglePin }: { isPinned?: boolean; onTogglePin?: () => void }) {
	if (!onTogglePin) return null;
	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				onTogglePin();
			}}
			className={`h-6 w-6 flex items-center justify-center rounded transition-all ${
				isPinned
					? "text-[var(--db-accent)] opacity-100"
					: "opacity-0 group-hover:opacity-100 text-[var(--db-text-tertiary)] hover:text-[var(--db-accent)]"
			}`}
		>
			<Pin className="h-3.5 w-3.5" />
		</button>
	);
}

function SelectCheckbox({
	isSelected,
	showCheckbox,
	onToggleSelect,
}: { isSelected?: boolean; showCheckbox?: boolean; onToggleSelect?: () => void }) {
	if (!onToggleSelect) return null;
	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				onToggleSelect();
			}}
			className={`h-5 w-5 rounded border flex items-center justify-center transition-all shrink-0 ${
				isSelected
					? "bg-[var(--db-accent)] border-[var(--db-accent)] text-[var(--db-text-on-dark)]"
					: showCheckbox
						? "border-[var(--db-muted-border)] hover:border-[var(--db-accent)]"
						: "border-[var(--db-muted-border)] opacity-0 group-hover:opacity-100 hover:border-[var(--db-accent)]"
			}`}
		>
			{isSelected && (
				<svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
					<path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			)}
		</button>
	);
}

export function ConversationCard({
	id,
	title,
	nodeCount,
	lastAccessedAt,
	isPinned,
	tags = [],
	isSelected,
	showCheckbox,
	onClick,
	onDelete,
	onTogglePin,
	onUpdateTags,
	onToggleSelect,
	viewMode,
}: ConversationCardProps) {
	if (viewMode === "list") {
		return (
			<div
				onClick={onClick}
				onKeyDown={(e) => e.key === "Enter" && onClick()}
				className={`group flex items-center gap-4 px-5 py-4 rounded-lg border hover:border-[var(--db-accent-border)] hover:shadow-md cursor-pointer transition-all duration-200 ${
					isSelected
						? "bg-[var(--db-accent-light)] border-[var(--db-accent-border)]"
						: "bg-[var(--db-surface)]/60 border-[var(--db-border)]"
				}`}
			>
				<SelectCheckbox isSelected={isSelected} showCheckbox={showCheckbox} onToggleSelect={onToggleSelect} />
				<div className="h-9 w-9 rounded-lg bg-[var(--db-accent-light)] flex items-center justify-center border border-[var(--db-accent-border)] group-hover:bg-[var(--db-accent)]/15 transition-colors shrink-0">
					<MessageSquare className="h-4 w-4 text-[var(--db-accent)]" />
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium text-[var(--db-text)] truncate">
						{title}
					</p>
					{tags.length > 0 && (
						<div className="flex gap-1 mt-1">
							{tags.map((tag) => (
								<span
									key={tag}
									className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full bg-[var(--db-accent-light)] text-[var(--db-accent)] text-[10px] font-medium"
								>
									<Tag className="h-2 w-2" />
									{tag}
								</span>
							))}
						</div>
					)}
				</div>
				<span className="text-xs text-[var(--db-text-tertiary)] shrink-0">
					{formatRelativeTime(lastAccessedAt)}
				</span>
				<span className="text-xs px-2 py-0.5 rounded bg-[var(--db-surface)] text-[var(--db-text-secondary)] border border-[var(--db-border)] shrink-0">
					{nodeCount} nodes
				</span>
				<PinButton isPinned={isPinned} onTogglePin={onTogglePin} />
				<DeleteDialog onDelete={onDelete} />
			</div>
		);
	}

	return (
		<TreePreviewPopover conversationId={id}>
			<div
				onClick={onClick}
				onKeyDown={(e) => e.key === "Enter" && onClick()}
				className={`group relative rounded-lg border hover:border-[var(--db-accent-border)] hover:shadow-lg hover:shadow-[var(--db-accent)]/5 cursor-pointer transition-all duration-300 backdrop-blur-sm ${
					isSelected
						? "bg-[var(--db-accent-light)] border-[var(--db-accent-border)]"
						: "bg-[var(--db-surface)]/60 border-[var(--db-border)]"
				}`}
			>
				<div className="p-5">
					<div className="flex justify-between items-start mb-4">
						<div className="flex items-center gap-2">
							<SelectCheckbox isSelected={isSelected} showCheckbox={showCheckbox} onToggleSelect={onToggleSelect} />
							<div className="h-10 w-10 rounded-lg bg-[var(--db-accent-light)] flex items-center justify-center border border-[var(--db-accent-border)] group-hover:bg-[var(--db-accent)]/15 transition-colors">
								<MessageSquare className="h-5 w-5 text-[var(--db-accent)]" />
							</div>
						</div>
						<div className="flex gap-1.5 items-center">
							<span className="text-xs px-2 py-0.5 rounded bg-[var(--db-surface)] text-[var(--db-text-secondary)] border border-[var(--db-border)]">
								{nodeCount} nodes
							</span>
							<PinButton isPinned={isPinned} onTogglePin={onTogglePin} />
							<DeleteDialog onDelete={onDelete} />
						</div>
					</div>
					<h3 className="text-base font-medium text-[var(--db-text)] line-clamp-2 mb-2">
						{title}
					</h3>
					<div className="flex items-center justify-between">
						<p className="text-sm text-[var(--db-text-tertiary)]">
							{formatRelativeTime(lastAccessedAt)}
						</p>
					</div>
					{(tags.length > 0 || onUpdateTags) && (
						<div className="mt-3">
							<TagManager
								tags={tags}
								onUpdateTags={onUpdateTags ?? (() => {})}
							/>
						</div>
					)}
				</div>
			</div>
		</TreePreviewPopover>
	);
}
