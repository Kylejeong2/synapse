import { GitBranch } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavProps {
	onSignIn: () => void;
}

export function Nav({ onSignIn }: NavProps) {
	return (
		<nav className="sticky top-0 z-50 border-b border-[var(--landing-border)] bg-[var(--landing-bg)]/90 backdrop-blur-sm">
			<div className="w-full landing-section h-16 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="h-9 w-9 rounded-md bg-[var(--landing-dark-bg)] flex items-center justify-center">
						<GitBranch className="h-4.5 w-4.5 text-[var(--landing-text-on-dark)]" />
					</div>
					<span className="text-xl font-semibold tracking-tight">Synapse</span>
				</div>
				<div className="flex items-center gap-3">
					<ThemeToggle />
					<button
						type="button"
						className="text-lg text-[var(--landing-text-secondary)] hover:text-[var(--landing-text)] px-3 py-2 hidden sm:block"
						onClick={onSignIn}
					>
						Sign in
					</button>
					<button
						type="button"
						className="text-lg font-medium bg-[var(--landing-dark-bg)] text-[var(--landing-text-on-dark)] rounded-md px-6 py-2.5 hover:bg-[var(--landing-dark-surface)]"
						onClick={onSignIn}
					>
						Get Started
					</button>
				</div>
			</div>
		</nav>
	);
}
