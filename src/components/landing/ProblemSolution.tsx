export function ProblemSolution() {
	return (
		<section className="bg-[#1a1715] text-[#faf8f3] py-24 sm:py-32 landing-section">
			<div className="max-w-3xl mx-auto text-center mb-16">
				<h2 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-6">
					AI conversations are a one-way street
				</h2>
				<p className="text-xl text-[#b5aea6] leading-relaxed">
					You're 15 messages deep into a great conversation. Then you want to
					try a different approach. In every other tool, you either lose your
					progress or start over. Synapse gives you a third option.
				</p>
			</div>

			<div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">
				<div className="rounded-lg border border-[#333] bg-[#262220] p-6">
					<p className="text-lg font-medium text-[#b5aea6] mb-4">Linear chat</p>
					<div className="space-y-2 mb-4">
						{[1, 2, 3, 4, 5].map((i) => (
							<div
								key={i}
								className="h-2 rounded-full bg-[#333]"
								style={{ width: `${100 - i * 8}%` }}
							/>
						))}
					</div>
					<p className="text-base text-[#6b6560]">One path. Can't go back.</p>
				</div>

				<div className="rounded-lg border border-[#c4642a]/40 bg-[#262220] p-6">
					<p className="text-lg font-medium text-[#faf8f3] mb-4">Synapse</p>
					<img
						src="/svgs/branching-conversation.svg"
						alt="Branching conversation"
						className="w-full h-12 mb-4"
					/>
					<p className="text-base text-[#b5aea6]">
						Branch anywhere. Explore everything.
					</p>
				</div>
			</div>
		</section>
	);
}
