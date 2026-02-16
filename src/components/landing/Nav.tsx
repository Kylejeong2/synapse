import { Link } from "@tanstack/react-router";
import { GitBranch } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function Nav() {
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
					<Link
						to="/sign-in"
						className="text-lg text-[var(--landing-text-secondary)] hover:text-[var(--landing-text)] px-3 py-2 hidden sm:block"
					>
						Sign in
					</Link>
					<Link
						to="/sign-in"
						className="text-lg font-medium bg-[var(--landing-dark-bg)] text-[var(--landing-text-on-dark)] rounded-md px-6 py-2.5 hover:bg-[var(--landing-dark-surface)]"
					>
						Get Started
					</Link>
				</div>
			</div>
		</nav>
	);
}
