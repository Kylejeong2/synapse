import { ForkDemo } from "./ForkDemo";

export function HowItWorks() {
	return (
		<section data-section="how" className="py-24 sm:py-32 landing-section">
			<div className="w-full">
				<div className="text-center mb-16">
					<h2 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-5">
						How it works
					</h2>
					<p className="text-xl text-[var(--landing-text-secondary)]">
						Three actions. Infinite possibilities.
					</p>
				</div>

				<ForkDemo />

				<div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-16">
					{[
						{ n: "1", label: "Chat normally with any model" },
						{ n: "2", label: "Fork at any message to branch" },
						{ n: "3", label: "Navigate your tree of ideas" },
					].map((s) => (
						<div
							key={s.n}
							className="w-full sm:w-auto flex items-center gap-3 rounded-md border border-[var(--landing-border)] bg-[var(--landing-bg)] px-6 py-4"
						>
							<span className="h-7 w-7 rounded-full bg-[var(--landing-dark-bg)] text-[var(--landing-text-on-dark)] text-sm font-bold flex items-center justify-center shrink-0">
								{s.n}
							</span>
							<span className="text-lg text-[var(--landing-text)]">{s.label}</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
