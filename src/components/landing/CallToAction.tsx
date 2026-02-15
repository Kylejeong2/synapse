import { ArrowRight } from "lucide-react";

interface CallToActionProps {
	onSignIn: () => void;
}

export function CallToAction({ onSignIn }: CallToActionProps) {
	return (
		<section className="py-28 sm:py-36 landing-section">
			<div className="max-w-3xl mx-auto text-center">
				<h2 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-6">
					Your best ideas happen between the branches
				</h2>
				<p className="text-xl text-[#6b6560] mb-12">
					Start forking your AI conversations. Free to use, no credit card
					required.
				</p>
				<button
					type="button"
					className="w-full sm:w-auto h-14 px-10 text-lg font-medium bg-[#1a1715] text-[#faf8f3] rounded-md hover:bg-[#262220]"
					onClick={onSignIn}
				>
					Get Started Free
					<ArrowRight className="inline-block ml-2 h-5 w-5" />
				</button>
			</div>
		</section>
	);
}
