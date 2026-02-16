export function Stats() {
	return (
		<section className="py-20 sm:py-24 landing-section">
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-10 text-center">
				{[
					{ value: "5+", label: "AI models" },
					{ value: "Unlimited", label: "branches" },
					{ value: "100%", label: "context kept" },
				].map((s) => (
					<div key={s.label}>
						<div className="text-4xl sm:text-5xl font-semibold tracking-tight">
							{s.value}
						</div>
						<div className="text-lg text-[var(--landing-text-tertiary)] mt-2">
							{s.label}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
