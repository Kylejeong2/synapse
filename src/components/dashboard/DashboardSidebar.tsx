import {
	LayoutDashboard,
	MessageSquare,
	Pin,
	Plus,
	Tag,
} from "lucide-react";

export type DashboardSection = "overview" | "conversations" | "pinned" | "tags";

interface NavItem {
	section: DashboardSection;
	label: string;
	icon: React.ReactNode;
	count?: number;
}

interface DashboardSidebarProps {
	activeSection: DashboardSection;
	onSectionChange: (section: DashboardSection) => void;
	conversationCount: number;
	pinnedCount: number;
	onNewConversation: () => void;
	isCreating: boolean;
}

export function DashboardSidebar({
	activeSection,
	onSectionChange,
	conversationCount,
	pinnedCount,
	onNewConversation,
	isCreating,
}: DashboardSidebarProps) {
	const navItems: NavItem[] = [
		{
			section: "overview",
			label: "Overview",
			icon: <LayoutDashboard className="h-4 w-4" />,
		},
		{
			section: "conversations",
			label: "Conversations",
			icon: <MessageSquare className="h-4 w-4" />,
			count: conversationCount,
		},
		{
			section: "pinned",
			label: "Pinned",
			icon: <Pin className="h-4 w-4" />,
			count: pinnedCount,
		},
		{
			section: "tags",
			label: "Tags",
			icon: <Tag className="h-4 w-4" />,
		},
	];

	return (
		<aside className="w-60 shrink-0 bg-[var(--db-sidebar-bg)] border-r border-[var(--db-border)] flex flex-col h-screen sticky top-0">
			{/* Branding */}
			<div className="px-5 py-6 border-b border-[var(--db-border)]">
				<h2 className="text-lg font-semibold text-[var(--db-text)] tracking-tight">
					Synapse
				</h2>
				<p className="text-xs text-[var(--db-text-tertiary)] mt-0.5">
					AI Conversations
				</p>
			</div>

			{/* Navigation */}
			<nav className="flex-1 px-3 py-4 space-y-1">
				{navItems.map((item) => {
					const isActive = activeSection === item.section;
					return (
						<button
							key={item.section}
							type="button"
							onClick={() => onSectionChange(item.section)}
							className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
								isActive
									? "bg-[var(--db-dark-bg)] text-[var(--db-text-on-dark)] shadow-sm"
									: "text-[var(--db-text-secondary)] hover:bg-[var(--db-sidebar-hover)] hover:text-[var(--db-text)]"
							}`}
						>
							{item.icon}
							<span className="flex-1 text-left">{item.label}</span>
							{item.count !== undefined && item.count > 0 && (
								<span
									className={`text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
										isActive
											? "bg-white/15 text-[var(--db-text-on-dark)]"
											: "bg-[var(--db-border)] text-[var(--db-text-tertiary)]"
									}`}
								>
									{item.count}
								</span>
							)}
						</button>
					);
				})}
			</nav>

			{/* Actions */}
			<div className="px-3 py-4 border-t border-[var(--db-border)] space-y-2">
				<button
					type="button"
					onClick={onNewConversation}
					disabled={isCreating}
					className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--db-accent)] text-white text-sm font-medium hover:bg-[var(--db-accent-hover)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
				>
					<Plus className="h-4 w-4" />
					{isCreating ? "Creating..." : "New Conversation"}
				</button>
			</div>
		</aside>
	);
}
