import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function CallToAction() {
	return (
		<section className="py-28 sm:py-36 landing-section">
			<div className="max-w-3xl mx-auto text-center">
				<h2 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-6">
					Your best ideas happen between the branches
				</h2>
				<p className="text-xl text-[var(--landing-text-secondary)] mb-12">
					Start forking your AI conversations. Free to use, no credit card
					required.
				</p>
				<Link
					to="/sign-in"
					className="inline-flex items-center w-full sm:w-auto h-14 px-10 text-lg font-medium bg-[var(--landing-dark-bg)] text-[var(--landing-text-on-dark)] rounded-md hover:bg-[var(--landing-dark-surface)]"
				>
					Get Started Free
					<ArrowRight className="inline-block ml-2 h-5 w-5" />
				</Link>
			</div>
		</section>
	);
}
