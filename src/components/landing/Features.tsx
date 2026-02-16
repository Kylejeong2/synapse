import { Network } from "lucide-react";

export function Features() {
	return (
		<section className="bg-[var(--landing-dark-bg)] text-[var(--landing-text-on-dark)] py-24 sm:py-32 landing-section">
			<div className="w-full">
				<div className="text-center mb-20">
					<h2 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-5">
						Built for how you think
					</h2>
					<p className="text-xl text-[var(--landing-text-muted-dark)]">
						Not another chat wrapper. Synapse is a new way to interact with AI.
					</p>
				</div>

				<MultiModelFeature />
				<NavigationFeature />
				<ContextFeature />
			</div>
		</section>
	);
}

function MultiModelFeature() {
	return (
		<div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-20 mb-28">
			<div className="flex-1 max-w-lg pt-2">
				<p className="text-base font-semibold tracking-wide text-[var(--landing-accent)] mb-4">
					Multi-model
				</p>
				<h3 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
					Same prompt, different minds
				</h3>
				<p className="text-[var(--landing-text-muted-dark)] leading-relaxed text-lg">
					Send the same question to GPT-5, Claude, and Gemini on separate
					branches. Compare their approaches and pick the best answer, or
					combine insights from all of them.
				</p>
			</div>
			<div className="flex-1 w-full">
				<div className="space-y-3">
					<div className="flex justify-end mb-3">
						<div className="rounded-xl px-5 py-3 bg-[var(--landing-bg)] text-[var(--landing-text)] text-base max-w-[75%]">
							How should I handle inter-service communication?
						</div>
					</div>
					{[
						{
							name: "GPT-5",
							text: "Consider using a pub/sub pattern with message queues for async...",
						},
						{
							name: "Claude",
							text: "I'd recommend starting with a clear domain model. Here's why...",
						},
						{
							name: "Gemini",
							text: "Based on recent patterns, event sourcing with CQRS would give you...",
						},
					].map((m) => (
						<div
							key={m.name}
							className="rounded-lg border border-[var(--landing-dark-border)] bg-[var(--landing-dark-surface)] p-5"
						>
							<span className="text-base font-semibold text-[var(--landing-accent)]">
								{m.name}
							</span>
							<p className="text-base text-[var(--landing-text-muted-dark)] mt-1.5 leading-relaxed">
								{m.text}
							</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function NavigationFeature() {
	return (
		<div className="flex flex-col lg:flex-row-reverse items-start gap-12 lg:gap-20 mb-28">
			<div className="flex-1 max-w-lg pt-2">
				<p className="text-base font-semibold tracking-wide text-[var(--landing-accent)] mb-4">
					Navigation
				</p>
				<h3 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
					See the full picture
				</h3>
				<p className="text-[var(--landing-text-muted-dark)] leading-relaxed text-lg">
					Your conversation isn't a scroll. It's a map. The interactive tree
					view shows every branch, every fork, and every path. Click any node to
					jump straight to it.
				</p>
			</div>
			<div className="flex-1 w-full">
				<div className="rounded-lg border border-[var(--landing-dark-border)] bg-[var(--landing-dark-surface)] overflow-hidden">
					<div className="px-4 py-3 border-b border-[var(--landing-dark-border)] flex items-center gap-2">
						<Network className="h-4.5 w-4.5 text-[var(--landing-text-secondary)]" />
						<span className="text-base font-medium">Tree View</span>
					</div>
					<div className="p-5">
						<img
							src="/svgs/tree-navigation.svg"
							alt="Tree navigation"
							className="w-full"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

function ContextFeature() {
	return (
		<div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-20">
			<div className="flex-1 max-w-lg pt-2">
				<p className="text-base font-semibold tracking-wide text-[var(--landing-accent)] mb-4">
					Context
				</p>
				<h3 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
					Every branch remembers everything
				</h3>
				<p className="text-[var(--landing-text-muted-dark)] leading-relaxed text-lg">
					When you fork, the new branch inherits the complete parent history.
					The AI always has full context, no matter how deep you go. No
					copy-pasting, no re-explaining.
				</p>
			</div>
			<div className="flex-1 w-full">
				<div className="rounded-lg border border-[var(--landing-dark-border)] bg-[var(--landing-dark-surface)] p-6">
					<div className="space-y-3">
						{[
							{
								depth: 0,
								label: "Root: 'Explain ML'",
								tokens: "1.2k",
							},
							{
								depth: 1,
								label: "Branch: 'Neural networks'",
								tokens: "2.8k",
							},
							{
								depth: 2,
								label: "Branch: 'Transformers'",
								tokens: "4.1k",
							},
							{
								depth: 3,
								label: "Current: 'How does attention work?'",
								tokens: "5.9k total",
							},
						].map((item) => (
							<div
								key={item.label}
								className={`flex items-center justify-between rounded border-l-2 ${item.depth === 0 || item.depth === 3 ? "border-l-[var(--landing-accent)]" : "border-l-[var(--landing-text-secondary)]"} bg-[var(--landing-dark-bg)] px-4 py-3`}
								style={{ marginLeft: `${item.depth * 16}px` }}
							>
								<span className="text-base font-medium text-[var(--landing-text-on-dark)] truncate mr-4">
									{item.label}
								</span>
								<span className="text-sm text-[var(--landing-text-secondary)] whitespace-nowrap">
									{item.tokens}
								</span>
							</div>
						))}
					</div>
					<p className="text-sm text-[var(--landing-text-secondary)] text-center mt-5">
						Full chain inherited at every depth
					</p>
				</div>
			</div>
		</div>
	);
}
