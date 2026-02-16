import { Tag, X } from "lucide-react";

interface TagFilterProps {
	availableTags: string[];
	selectedTags: string[];
	onTagToggle: (tag: string) => void;
	onClearTags: () => void;
}

export function TagFilter({
	availableTags,
	selectedTags,
	onTagToggle,
	onClearTags,
}: TagFilterProps) {
	if (availableTags.length === 0) return null;

	return (
		<div className="flex flex-wrap items-center gap-2 mb-6">
			<Tag className="h-3.5 w-3.5 text-[var(--db-text-tertiary)]" />
			{availableTags.map((tag) => {
				const isSelected = selectedTags.includes(tag);
				return (
					<button
						key={tag}
						type="button"
						onClick={() => onTagToggle(tag)}
						className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
							isSelected
								? "bg-[var(--db-accent)] text-[var(--db-text-on-dark)]"
								: "bg-[var(--db-subtle)] border border-[var(--db-border)] text-[var(--db-text-secondary)] hover:border-[var(--db-accent-border)]"
						}`}
					>
						{tag}
					</button>
				);
			})}
			{selectedTags.length > 0 && (
				<button
					type="button"
					onClick={onClearTags}
					className="flex items-center gap-1 text-xs text-[var(--db-accent)] hover:text-[var(--db-accent-hover)] font-medium transition-colors"
				>
					<X className="h-3 w-3" />
					Clear
				</button>
			)}
		</div>
	);
}
