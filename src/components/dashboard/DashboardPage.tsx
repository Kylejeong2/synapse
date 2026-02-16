import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
	useConversations,
	useCreateConversation,
	useDeleteConversation,
	useTogglePin,
	useUpdateTags,
} from "@/hooks/useConversation";
import {
	useDashboardStats,
	useRecentConversations,
} from "@/hooks/useDashboard";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { log } from "@/lib/logger";
import { DashboardSidebar, type DashboardSection } from "./DashboardSidebar";
import { ShortcutHelpModal } from "./ShortcutHelpModal";
import { ConversationsSection } from "./sections/ConversationsSection";
import { OverviewSection } from "./sections/OverviewSection";
import { PinnedSectionPage } from "./sections/PinnedSection";
import { TagsSection } from "./sections/TagsSection";
import "./dashboard.css";

export function DashboardPage() {
	const { user } = useUser();
	const navigate = useNavigate();
	const conversations = useConversations(user?.id);
	const stats = useDashboardStats(user?.id);
	const recentConversations = useRecentConversations(user?.id, 3);
	const createConversation = useCreateConversation();
	const deleteConversation = useDeleteConversation();
	const togglePin = useTogglePin();
	const updateTags = useUpdateTags();
	const searchInputRef = useRef<HTMLInputElement>(null);

	const [activeSection, setActiveSection] =
		useState<DashboardSection>("overview");
	const [isCreating, setIsCreating] = useState(false);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);

	const handleNewConversation = useCallback(async () => {
		if (!user?.id) return;
		setIsCreating(true);
		try {
			const conversationId = await createConversation({
				userId: user.id,
				title: "New Conversation",
			});
			navigate({
				to: "/chat/$id",
				params: { id: conversationId },
				search: { fromNode: undefined },
			});
		} catch (error) {
			log.error(
				"Failed to create conversation",
				error instanceof Error ? error : undefined,
				{ component: "DashboardPage" },
			);
		} finally {
			setIsCreating(false);
		}
	}, [createConversation, navigate, user?.id]);

	const handleDeleteConversation = async (
		conversationId: string,
		e: React.MouseEvent,
	) => {
		e.stopPropagation();
		try {
			await deleteConversation({ conversationId });
		} catch (error) {
			log.error(
				"Failed to delete conversation",
				error instanceof Error ? error : undefined,
				{ conversationId, component: "DashboardPage" },
			);
		}
	};

	const handleTogglePin = async (conversationId: string) => {
		try {
			await togglePin({ conversationId });
		} catch (error) {
			log.error(
				"Failed to toggle pin",
				error instanceof Error ? error : undefined,
				{ conversationId, component: "DashboardPage" },
			);
		}
	};

	const handleUpdateTags = async (conversationId: string, tags: string[]) => {
		try {
			await updateTags({ conversationId, tags });
		} catch (error) {
			log.error(
				"Failed to update tags",
				error instanceof Error ? error : undefined,
				{ conversationId, component: "DashboardPage" },
			);
		}
	};

	const navigateToChat = useCallback(
		(id: string) =>
			navigate({
				to: "/chat/$id",
				params: { id },
				search: { fromNode: undefined },
			}),
		[navigate],
	);

	const pinnedCount = useMemo(
		() => conversations?.filter((c) => c.isPinned).length ?? 0,
		[conversations],
	);

	const hasConversations = conversations && conversations.length > 0;

	// Keyboard shortcuts
	const shortcutHandlers = useMemo(
		() => ({
			onNewConversation: handleNewConversation,
			onFocusSearch: () => {
				setActiveSection("conversations");
				setTimeout(() => searchInputRef.current?.focus(), 50);
			},
			onOpenRecent: (index: number) => {
				if (conversations?.[index]) {
					navigateToChat(conversations[index]._id);
				}
			},
			onShowHelp: () => setShortcutsOpen(true),
			onEscape: () => {
				setShortcutsOpen(false);
			},
		}),
		[conversations, handleNewConversation, navigateToChat],
	);
	useKeyboardShortcuts(shortcutHandlers);

	return (
		<div className="dashboard flex min-h-screen bg-[var(--db-bg)]">
			<DashboardSidebar
				activeSection={activeSection}
				onSectionChange={setActiveSection}
				conversationCount={conversations?.length ?? 0}
				pinnedCount={pinnedCount}
				onNewConversation={handleNewConversation}
				isCreating={isCreating}
			/>

			<main className="flex-1 overflow-auto">
				<div className="max-w-6xl mx-auto px-8 py-10">
					{activeSection === "overview" && (
						<OverviewSection
							stats={stats}
							recentConversations={recentConversations}
							hasConversations={!!hasConversations}
							conversationCount={conversations?.length ?? 0}
							onContinue={navigateToChat}
							onNewConversation={handleNewConversation}
						/>
					)}

					{activeSection === "conversations" && (
						<ConversationsSection
							conversations={conversations}
							onConversationClick={navigateToChat}
							onConversationDelete={handleDeleteConversation}
							onTogglePin={handleTogglePin}
							onUpdateTags={handleUpdateTags}
							onNewConversation={handleNewConversation}
							searchInputRef={searchInputRef}
						/>
					)}

					{activeSection === "pinned" && (
						<PinnedSectionPage
							conversations={conversations}
							onConversationClick={navigateToChat}
							onConversationDelete={handleDeleteConversation}
							onTogglePin={handleTogglePin}
							onUpdateTags={handleUpdateTags}
						/>
					)}

					{activeSection === "tags" && (
						<TagsSection
							conversations={conversations}
							onConversationClick={navigateToChat}
							onConversationDelete={handleDeleteConversation}
							onTogglePin={handleTogglePin}
							onUpdateTags={handleUpdateTags}
						/>
					)}
				</div>
			</main>

			<ShortcutHelpModal
				open={shortcutsOpen}
				onClose={() => setShortcutsOpen(false)}
			/>
		</div>
	);
}
