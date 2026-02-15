import { useState } from "react";
import "./landing.css";
import { CallToAction } from "./CallToAction";
import { Features } from "./Features";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Nav } from "./Nav";
import { ProblemSolution } from "./ProblemSolution";
import { SignInModal } from "./SignInModal";
import { Stats } from "./Stats";

export function LandingPage() {
	const [showSignIn, setShowSignIn] = useState(false);
	const openSignIn = () => setShowSignIn(true);

	return (
		<div className="landing min-h-screen bg-[#faf8f3] text-[#1a1715]">
			<Nav onSignIn={openSignIn} />
			<Hero onSignIn={openSignIn} />
			<Stats />
			<ProblemSolution />
			<HowItWorks />
			<Features />
			<CallToAction onSignIn={openSignIn} />
			<Footer />
			<SignInModal open={showSignIn} onClose={() => setShowSignIn(false)} />
		</div>
	);
}
