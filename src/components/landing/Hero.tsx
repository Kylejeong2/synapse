import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { ProductMockup } from "./ProductMockup";

const providers = ["Anthropic", "OpenAI", "Google"];

interface HeroProps {
	onSignIn: () => void;
}

export function Hero({ onSignIn }: HeroProps) {
	const [index, setIndex] = useState(0);
	const [fading, setFading] = useState(false);

	useEffect(() => {
		const interval = setInterval(() => {
			setFading(true);
			setTimeout(() => {
				setIndex((i) => (i + 1) % providers.length);
				setFading(false);
			}, 300);
		}, 2500);
		return () => clearInterval(interval);
	}, []);

	return (
		<section className="pt-20 sm:pt-32 pb-8 landing-section">
			<div className="w-full">
				<div className="max-w-3xl mx-auto text-center mb-16 sm:mb-24">
					<p className="text-base font-medium tracking-wide text-[#c4642a] mb-6">
						Branching conversations for AI
					</p>

					<h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.08] mb-8">
						Stop losing ideas to linear threads
					</h1>

					<p className="text-xl sm:text-2xl text-[#6b6560] leading-relaxed mb-12">
						Fork your AI conversation at any message.
					</p>

					<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
						<button
							type="button"
							className="w-full sm:w-auto h-14 px-10 text-lg font-medium bg-[#1a1715] text-[#faf8f3] rounded-md hover:bg-[#262220]"
							onClick={onSignIn}
						>
							Start for Free
							<ArrowRight className="inline-block ml-2 h-5 w-5" />
						</button>
						<button
							type="button"
							className="w-full sm:w-auto h-14 px-10 text-lg font-medium text-[#1a1715] border border-[#e8e3d9] rounded-md hover:bg-[#f0ece4]"
							onClick={() =>
								document
									.querySelector("[data-section='how']")
									?.scrollIntoView({ behavior: "smooth" })
							}
						>
							See how it works
						</button>
					</div>

					<p className="text-xl sm:text-2xl text-[#9c958e] mt-10">
						Works with{" "}
						<span
							className="inline-block font-semibold text-[#1a1715] transition-opacity duration-300"
							style={{ opacity: fading ? 0 : 1 }}
						>
							{providers[index]}
						</span>{" "}
						models
					</p>
				</div>

				<div className="max-w-5xl mx-auto">
					<ProductMockup />
				</div>
			</div>
		</section>
	);
}
