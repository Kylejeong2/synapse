import { ArrowUp, GitFork, Network } from "lucide-react";

export function ProductMockup() {
	return (
		<div className="rounded-lg border border-[#e8e3d9] bg-[#f0ece4] overflow-hidden shadow-sm">
			{/* Title bar */}
			<div className="flex items-center gap-2 px-4 py-3 border-b border-[#e8e3d9]">
				<div className="flex gap-1.5">
					<div className="h-3 w-3 rounded-full bg-[#d4cfc7]" />
					<div className="h-3 w-3 rounded-full bg-[#d4cfc7]" />
					<div className="h-3 w-3 rounded-full bg-[#d4cfc7]" />
				</div>
				<div className="flex-1 text-center">
					<span className="text-sm text-[#9c958e] font-medium tracking-wide">
						Synapse
					</span>
				</div>
				<div className="w-[50px]" />
			</div>

			<div className="flex min-h-[420px]">
				{/* Left: Tree panel */}
				<div className="w-[280px] border-r border-[#e8e3d9] bg-[#f5f2eb] hidden md:flex flex-col">
					<div className="px-4 py-3 border-b border-[#e8e3d9] flex items-center gap-2">
						<Network className="h-4 w-4 text-[#9c958e]" />
						<span className="text-sm font-medium text-[#1a1715]">
							Conversation Tree
						</span>
						<span className="ml-auto text-xs text-[#9c958e] bg-[#e8e3d9] rounded px-2 py-0.5">
							5
						</span>
					</div>

					<div className="flex-1 relative p-4">
						<img
							src="/svgs/conversation-tree.svg"
							alt="Conversation tree"
							className="w-full h-full"
						/>
					</div>
				</div>

				{/* Right: Chat panel */}
				<div className="flex-1 flex flex-col bg-[#faf8f3]">
					<div className="px-4 py-2.5 border-b border-[#e8e3d9] flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="text-xs text-[#9c958e]">Forking from:</span>
							<span className="text-xs font-medium text-[#1a1715] bg-[#f0ece4] rounded px-2 py-0.5">
								Use microservices
							</span>
						</div>
						<span className="text-xs text-[#9c958e] flex items-center gap-1.5">
							<span className="h-1.5 w-1.5 rounded-full bg-[#c4642a]" />
							Claude Sonnet
						</span>
					</div>

					<div className="flex-1 overflow-hidden px-4 sm:px-5 py-5 space-y-4">
						<div className="flex justify-end">
							<div className="max-w-[80%] rounded-2xl px-4 py-3 bg-[#1a1715] text-[#faf8f3] text-base leading-relaxed">
								What are the trade-offs of starting with microservices vs adding
								them later?
							</div>
						</div>

						<div className="space-y-2">
							<p className="text-base leading-relaxed text-[#1a1715]">
								Great question. Starting with microservices gives you{" "}
								<strong>independent deployability</strong> and{" "}
								<strong>team autonomy</strong> from day one, but comes with
								operational overhead:
							</p>
							<ul className="text-base leading-relaxed text-[#1a1715] space-y-1 pl-4">
								<li className="list-disc">
									Service discovery and orchestration
								</li>
								<li className="list-disc">Distributed tracing complexity</li>
								<li className="list-disc">
									Data consistency across boundaries
								</li>
							</ul>
							<p className="text-base leading-relaxed text-[#6b6560]">
								My recommendation: start with a{" "}
								<strong className="text-[#1a1715]">modular monolith</strong>,
								then extract services as scaling demands...
							</p>
						</div>

						<div className="flex items-center gap-2 pt-1">
							<div className="h-px flex-1 bg-[#e8e3d9]" />
							<span className="flex items-center gap-1 text-xs text-[#9c958e]">
								<GitFork className="h-3.5 w-3.5" />
								fork
							</span>
							<div className="h-px flex-1 bg-[#e8e3d9]" />
						</div>

						<div className="flex justify-end">
							<div className="max-w-[80%] rounded-2xl px-4 py-3 bg-[#1a1715] text-[#faf8f3] text-base leading-relaxed">
								What about event-driven architecture instead?
							</div>
						</div>

						<div className="flex gap-1 pt-1">
							<div className="w-1.5 h-1.5 bg-[#9c958e] rounded-full" />
							<div className="w-1.5 h-1.5 bg-[#c4cfc7] rounded-full" />
							<div className="w-1.5 h-1.5 bg-[#d4cfc7] rounded-full" />
						</div>
					</div>

					<div className="px-4 sm:px-5 pb-3 pt-2 border-t border-[#e8e3d9]">
						<div className="flex items-end rounded-xl border border-[#e8e3d9] bg-[#f5f2eb] px-3 py-2.5">
							<span className="flex-1 text-base text-[#9c958e] py-0.5">
								Message Synapse
							</span>
							<div className="h-7 w-7 rounded-md bg-[#e8e3d9] flex items-center justify-center">
								<ArrowUp className="h-3.5 w-3.5 text-[#9c958e]" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
