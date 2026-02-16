import { Plus, Tag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface TagManagerProps {
	tags: string[];
	onUpdateTags: (tags: string[]) => void;
}

export function TagManager({ tags, onUpdateTags }: TagManagerProps) {
	const [isAdding, setIsAdding] = useState(false);
	const [newTag, setNewTag] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isAdding) {
			inputRef.current?.focus();
		}
	}, [isAdding]);

	const handleAddTag = () => {
		const trimmed = newTag.trim().toLowerCase();
		if (trimmed && !tags.includes(trimmed)) {
			onUpdateTags([...tags, trimmed]);
		}
		setNewTag("");
		setIsAdding(false);
	};

	const handleRemoveTag = (tag: string) => {
		onUpdateTags(tags.filter((t) => t !== tag));
	};

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			{tags.map((tag) => (
				<span
					key={tag}
					className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--db-accent-light)] text-[var(--db-accent)] text-xs font-medium"
				>
					<Tag className="h-2.5 w-2.5" />
					{tag}
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							handleRemoveTag(tag);
						}}
						className="hover:text-red-500 transition-colors"
					>
						<X className="h-2.5 w-2.5" />
					</button>
				</span>
			))}
			{isAdding ? (
				<input
					type="text"
					value={newTag}
					onChange={(e) => setNewTag(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleAddTag();
						if (e.key === "Escape") {
							setIsAdding(false);
							setNewTag("");
						}
					}}
					onBlur={handleAddTag}
					onClick={(e) => e.stopPropagation()}
					onMouseDown={(e) => e.stopPropagation()}
					placeholder="tag name"
					ref={inputRef}
					className="w-20 px-2 py-0.5 rounded-full border border-[var(--db-border)] bg-[var(--db-subtle)] text-xs text-[var(--db-text)] placeholder:text-[var(--db-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--db-accent-border)]"
				/>
			) : (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						setIsAdding(true);
					}}
					className="h-5 w-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-[var(--db-surface)] text-[var(--db-text-tertiary)] hover:text-[var(--db-accent)] transition-all"
				>
					<Plus className="h-3 w-3" />
				</button>
			)}
		</div>
	);
}
