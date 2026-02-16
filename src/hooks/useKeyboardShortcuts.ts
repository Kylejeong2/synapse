import { useEffect } from "react";

interface ShortcutHandlers {
	onNewConversation: () => void;
	onFocusSearch: () => void;
	onOpenRecent: (index: number) => void;
	onShowHelp: () => void;
	onEscape: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ignore when typing in inputs/textareas
			const target = e.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.tagName === "SELECT" ||
				target.isContentEditable
			) {
				if (e.key === "Escape") {
					(target as HTMLInputElement).blur();
					handlers.onEscape();
				}
				return;
			}

			switch (e.key) {
				case "n":
				case "N":
					if (!e.metaKey && !e.ctrlKey) {
						e.preventDefault();
						handlers.onNewConversation();
					}
					break;
				case "/":
					e.preventDefault();
					handlers.onFocusSearch();
					break;
				case "?":
					e.preventDefault();
					handlers.onShowHelp();
					break;
				case "Escape":
					handlers.onEscape();
					break;
				default:
					// Number keys 1-9 to open recent conversations
					if (e.key >= "1" && e.key <= "9" && !e.metaKey && !e.ctrlKey) {
						e.preventDefault();
						handlers.onOpenRecent(Number.parseInt(e.key, 10) - 1);
					}
					break;
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [handlers]);
}
