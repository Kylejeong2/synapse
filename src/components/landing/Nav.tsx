import { GitBranch } from "lucide-react";

interface NavProps {
	onSignIn: () => void;
}

export function Nav({ onSignIn }: NavProps) {
	return (
		<nav className="sticky top-0 z-50 border-b border-[#e8e3d9] bg-[#faf8f3]/90 backdrop-blur-sm">
			<div className="w-full landing-section h-16 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="h-9 w-9 rounded-md bg-[#1a1715] flex items-center justify-center">
						<GitBranch className="h-4.5 w-4.5 text-[#faf8f3]" />
					</div>
					<span className="text-xl font-semibold tracking-tight">Synapse</span>
				</div>
				<div className="flex items-center gap-3">
					<button
						type="button"
						className="text-lg text-[#6b6560] hover:text-[#1a1715] px-3 py-2 hidden sm:block"
						onClick={onSignIn}
					>
						Sign in
					</button>
					<button
						type="button"
						className="text-lg font-medium bg-[#1a1715] text-[#faf8f3] rounded-md px-6 py-2.5 hover:bg-[#262220]"
						onClick={onSignIn}
					>
						Get Started
					</button>
				</div>
			</div>
		</nav>
	);
}
