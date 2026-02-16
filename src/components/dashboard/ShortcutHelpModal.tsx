import { X } from "lucide-react";

interface ShortcutHelpModalProps {
	open: boolean;
	onClose: () => void;
}

const SHORTCUTS = [
	{ key: "N", description: "New conversation" },
	{ key: "/", description: "Focus search" },
	{ key: "1-9", description: "Open Nth recent conversation" },
	{ key: "?", description: "Show this help" },
	{ key: "Esc", description: "Clear selection / close modals" },
];

export function ShortcutHelpModal({ open, onClose }: ShortcutHelpModalProps) {
	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div
				className="absolute inset-0 bg-[var(--db-dark-bg)]/60 backdrop-blur-sm"
				onClick={onClose}
				onKeyDown={() => {}}
			/>
			<div className="relative bg-[var(--db-bg)] border border-[var(--db-border)] rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
				<div className="flex items-center justify-between mb-5">
					<h2 className="text-lg font-semibold text-[var(--db-text)]">
						Keyboard Shortcuts
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-[var(--db-surface)] transition-colors"
					>
						<X className="h-4 w-4 text-[var(--db-text-secondary)]" />
					</button>
				</div>
				<div className="space-y-3">
					{SHORTCUTS.map((shortcut) => (
						<div
							key={shortcut.key}
							className="flex items-center justify-between"
						>
							<span className="text-sm text-[var(--db-text-secondary)]">
								{shortcut.description}
							</span>
							<kbd className="px-2 py-1 rounded bg-[var(--db-surface)] border border-[var(--db-border)] text-xs font-mono text-[var(--db-text)] min-w-[32px] text-center">
								{shortcut.key}
							</kbd>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
