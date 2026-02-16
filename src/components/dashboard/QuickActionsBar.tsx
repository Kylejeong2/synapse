import {
	ArrowDownAZ,
	ArrowUpDown,
	Calendar,
	Grid3X3,
	List,
	Search,
	TreePine,
} from "lucide-react";

export type SortBy = "lastAccessed" | "created" | "nodeCount" | "alphabetical";
export type ViewMode = "grid" | "list";

interface QuickActionsBarProps {
	searchQuery: string;
	onSearchChange: (query: string) => void;
	sortBy: SortBy;
	onSortChange: (sort: SortBy) => void;
	viewMode: ViewMode;
	onViewModeChange: (mode: ViewMode) => void;
	searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

const SORT_OPTIONS: { value: SortBy; label: string; icon: React.ReactNode }[] =
	[
		{
			value: "lastAccessed",
			label: "Last Accessed",
			icon: <Calendar className="h-4 w-4" />,
		},
		{
			value: "created",
			label: "Date Created",
			icon: <ArrowUpDown className="h-4 w-4" />,
		},
		{
			value: "nodeCount",
			label: "Most Branches",
			icon: <TreePine className="h-4 w-4" />,
		},
		{
			value: "alphabetical",
			label: "Alphabetical",
			icon: <ArrowDownAZ className="h-4 w-4" />,
		},
	];

export function QuickActionsBar({
	searchQuery,
	onSearchChange,
	sortBy,
	onSortChange,
	viewMode,
	onViewModeChange,
	searchInputRef,
}: QuickActionsBarProps) {
	return (
		<div className="mb-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
			{/* Search */}
			<div className="relative flex-1">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--db-text-tertiary)]" />
				<input
					ref={searchInputRef}
					type="text"
					placeholder="Search titles and messages..."
					value={searchQuery}
					onChange={(e) => onSearchChange(e.target.value)}
					className="w-full pl-10 pr-4 py-2.5 rounded-md bg-[var(--db-subtle)] border border-[var(--db-border)] text-[var(--db-text)] placeholder:text-[var(--db-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--db-accent-border)] focus:border-[var(--db-accent-border)] transition-all text-sm"
				/>
			</div>

			{/* Sort Dropdown */}
			<div className="relative">
				<select
					value={sortBy}
					onChange={(e) => onSortChange(e.target.value as SortBy)}
					className="appearance-none pl-3 pr-8 py-2.5 rounded-md bg-[var(--db-subtle)] border border-[var(--db-border)] text-[var(--db-text)] text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--db-accent-border)] transition-all"
				>
					{SORT_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
				<ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--db-text-tertiary)] pointer-events-none" />
			</div>

			{/* View Mode Toggle */}
			<div className="flex rounded-md border border-[var(--db-border)] overflow-hidden">
				<button
					type="button"
					onClick={() => onViewModeChange("grid")}
					className={`flex items-center gap-1.5 px-3 py-2.5 text-sm transition-all ${
						viewMode === "grid"
							? "bg-[var(--db-dark-bg)] text-[var(--db-text-on-dark)]"
							: "bg-[var(--db-subtle)] text-[var(--db-text-secondary)] hover:bg-[var(--db-surface)]"
					}`}
				>
					<Grid3X3 className="h-4 w-4" />
				</button>
				<button
					type="button"
					onClick={() => onViewModeChange("list")}
					className={`flex items-center gap-1.5 px-3 py-2.5 text-sm transition-all ${
						viewMode === "list"
							? "bg-[var(--db-dark-bg)] text-[var(--db-text-on-dark)]"
							: "bg-[var(--db-subtle)] text-[var(--db-text-secondary)] hover:bg-[var(--db-surface)]"
					}`}
				>
					<List className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}
