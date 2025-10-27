import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ResizableLayoutProps {
	left: React.ReactNode;
	right: React.ReactNode;
	defaultLeftWidth?: number;
	minLeftWidth?: number;
	maxLeftWidth?: number;
}

export function ResizableLayout({
	left,
	right,
	defaultLeftWidth = 33,
	minLeftWidth = 20,
	maxLeftWidth = 50,
}: ResizableLayoutProps) {
	const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
	const [isDragging, setIsDragging] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (!isDragging || !containerRef.current) return;

			const container = containerRef.current;
			const containerRect = container.getBoundingClientRect();
			const newLeftWidth =
				((e.clientX - containerRect.left) / containerRect.width) * 100;

			if (newLeftWidth >= minLeftWidth && newLeftWidth <= maxLeftWidth) {
				setLeftWidth(newLeftWidth);
			}
		};

		const handleMouseUp = () => {
			setIsDragging(false);
		};

		if (isDragging) {
			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		}

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isDragging, minLeftWidth, maxLeftWidth]);

	return (
		<div
			ref={containerRef}
			className="flex h-screen overflow-hidden"
			style={{ cursor: isDragging ? "col-resize" : "default" }}
		>
			{/* Left Panel */}
			<div
				className="relative bg-muted/30 hidden md:block"
				style={{ width: `${leftWidth}%` }}
			>
				{left}
			</div>

			{/* Divider */}
			<div
				className="hidden md:block w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors relative group"
				onMouseDown={() => setIsDragging(true)}
			>
				<div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
					<div className="w-1 h-12 bg-primary rounded-full" />
				</div>
			</div>

			{/* Right Panel */}
			<div
				className={cn("flex-1 md:flex-none")}
				style={{ width: `${100 - leftWidth}%` }}
			>
				{right}
			</div>
		</div>
	);
}
