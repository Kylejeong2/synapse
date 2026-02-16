import "./landing.css";
import { CallToAction } from "./CallToAction";
import { Features } from "./Features";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Nav } from "./Nav";
import { ProblemSolution } from "./ProblemSolution";
import { Stats } from "./Stats";

export function LandingPage() {
	return (
		<div className="landing min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)]">
			<Nav />
			<Hero />
			<Stats />
			<ProblemSolution />
			<HowItWorks />
			<Features />
			<CallToAction />
			<Footer />
		</div>
	);
}
