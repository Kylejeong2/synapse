import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { Id } from "../../../convex/_generated/dataModel";
import { ContextModal } from "./ContextModal";

interface ContextIndicatorProps {
	nodeId: Id<"nodes">;
	tokensUsed: number;
	cumulativeTokens?: number;
	maxTokens?: number;
}

export function ContextIndicator({
	nodeId,
	tokensUsed,
	cumulativeTokens,
	maxTokens = 128000,
}: ContextIndicatorProps) {
	const [open, setOpen] = useState(false);
	const displayTokens = cumulativeTokens ?? tokensUsed;
	const percentage = (displayTokens / maxTokens) * 100;
	const progressColor =
		percentage < 50
			? "bg-green-500"
			: percentage < 80
				? "bg-yellow-500"
				: "bg-red-500";

	return (
		<div className="space-y-1">
			<div className="flex justify-between items-center">
				<Badge variant="outline" className="text-xs">
					{displayTokens.toLocaleString()} tokens
					{cumulativeTokens && (
						<span className="text-muted-foreground ml-1">(total)</span>
					)}
				</Badge>
				<span className="text-xs text-muted-foreground">
					{percentage.toFixed(0)}%
				</span>
			</div>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogTrigger asChild>
					<button type="button" className="w-full">
						<Progress
							value={percentage}
							className={`h-2 cursor-pointer hover:h-3 transition-all ${progressColor}`}
						/>
					</button>
				</DialogTrigger>
				<ContextModal nodeId={nodeId} onClose={() => setOpen(false)} />
			</Dialog>
		</div>
	);
}
