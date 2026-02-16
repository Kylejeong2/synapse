import { CheckSquare, Square, Trash2, X } from "lucide-react";

interface BulkActionToolbarProps {
	selectedCount: number;
	totalCount: number;
	onSelectAll: () => void;
	onClearSelection: () => void;
	onDeleteSelected: () => void;
}

export function BulkActionToolbar({
	selectedCount,
	totalCount,
	onSelectAll,
	onClearSelection,
	onDeleteSelected,
}: BulkActionToolbarProps) {
	if (selectedCount === 0) return null;

	return (
		<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-xl bg-[var(--db-dark-bg)] border border-[var(--db-dark-border)] shadow-2xl backdrop-blur-sm">
			<span className="text-sm text-[var(--db-text-on-dark)]">
				{selectedCount} selected
			</span>

			<div className="h-4 w-px bg-[var(--db-on-dark-divider)]" />

			<button
				type="button"
				onClick={selectedCount === totalCount ? onClearSelection : onSelectAll}
				className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[var(--db-text-muted-dark)] hover:text-[var(--db-text-on-dark)] hover:bg-[var(--db-on-dark-overlay)] transition-all"
			>
				{selectedCount === totalCount ? (
					<>
						<Square className="h-3.5 w-3.5" />
						Deselect All
					</>
				) : (
					<>
						<CheckSquare className="h-3.5 w-3.5" />
						Select All
					</>
				)}
			</button>

			<button
				type="button"
				onClick={onDeleteSelected}
				className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
			>
				<Trash2 className="h-3.5 w-3.5" />
				Delete
			</button>

			<button
				type="button"
				onClick={onClearSelection}
				className="flex items-center justify-center h-7 w-7 rounded-md text-[var(--db-text-muted-dark)] hover:text-[var(--db-text-on-dark)] hover:bg-[var(--db-on-dark-overlay)] transition-all"
			>
				<X className="h-4 w-4" />
			</button>
		</div>
	);
}
