import { GitBranch } from "lucide-react";

export function Footer() {
	return (
		<footer className="border-t border-[var(--landing-border)] py-10 landing-section">
			<div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
				<div className="flex items-center gap-2.5">
					<div className="h-7 w-7 rounded bg-[var(--landing-dark-bg)] flex items-center justify-center">
						<GitBranch className="h-3.5 w-3.5 text-[var(--landing-text-on-dark)]" />
					</div>
					<span className="text-lg font-medium">Synapse</span>
				</div>
				<p className="text-base text-[var(--landing-text-tertiary)]">Built for curious minds.</p>
			</div>
		</footer>
	);
}
