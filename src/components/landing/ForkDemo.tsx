import { GitFork } from "lucide-react";

export function ForkDemo() {
	return (
		<div className="max-w-2xl mx-auto">
			<div className="flex flex-col items-center gap-3">
				<div className="w-full rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg)] p-5">
					<div className="flex items-center gap-3 mb-2">
						<div className="h-6 w-6 rounded-full bg-[var(--landing-border)] flex items-center justify-center">
							<span className="text-xs font-bold text-[var(--landing-text-secondary)]">
								U
							</span>
						</div>
						<span className="text-base font-medium text-[var(--landing-text)]">
							Explain quantum computing
						</span>
					</div>
					<p className="text-sm text-[var(--landing-text-secondary)] pl-9 leading-relaxed">
						AI: Quantum computing uses qubits that exist in superposition...
					</p>
				</div>

				<div className="h-6 w-px bg-[var(--landing-muted-border)]" />

				<div className="relative w-full">
					<div className="rounded-lg border-2 border-[var(--landing-accent)] bg-[var(--landing-bg)] p-5">
						<div className="flex items-center gap-3 mb-2">
							<div className="h-6 w-6 rounded-full bg-[var(--landing-border)] flex items-center justify-center">
								<span className="text-xs font-bold text-[var(--landing-text-secondary)]">
									U
								</span>
							</div>
							<span className="text-base font-medium text-[var(--landing-text)]">
								How does error correction work?
							</span>
						</div>
						<p className="text-sm text-[var(--landing-text-secondary)] pl-9 leading-relaxed">
							AI: Error correction in quantum systems relies on redundancy...
						</p>
					</div>
					<div className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-[var(--landing-accent)] flex items-center justify-center">
						<GitFork className="h-3.5 w-3.5 text-[var(--landing-bg)]" />
					</div>
				</div>

				<img
					src="/svgs/fork-branches.svg"
					alt="Fork branches"
					className="w-full h-6"
				/>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
					<div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg)] p-5">
						<span className="text-sm font-semibold text-[var(--landing-accent)] tracking-wide">
							GPT-5
						</span>
						<p className="text-base font-medium text-[var(--landing-text)] mt-1.5">
							Explain it simply
						</p>
						<p className="text-sm text-[var(--landing-text-secondary)] mt-1 leading-relaxed">
							Think of qubits like coins spinning in the air...
						</p>
					</div>
					<div className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-bg)] p-5">
						<span className="text-sm font-semibold text-[var(--landing-accent)] tracking-wide">
							Claude
						</span>
						<p className="text-base font-medium text-[var(--landing-text)] mt-1.5">
							Go deeper technically
						</p>
						<p className="text-sm text-[var(--landing-text-secondary)] mt-1 leading-relaxed">
							Surface codes implement topological protection via...
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
