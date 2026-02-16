import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface InputBarProps {
	onSend: (message: string) => void;
	isLoading: boolean;
	placeholder?: string;
}

export function InputBar({
	onSend,
	isLoading,
	placeholder = "Message ChatGPT",
}: InputBarProps) {
	const [input, setInput] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (input.trim() && !isLoading) {
			onSend(input.trim());
			setInput("");
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	};

	// Auto-resize textarea
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
		}
	}, []);

	return (
		<form onSubmit={handleSubmit} className="relative">
			<div className="relative flex items-end bg-background rounded-3xl shadow-sm border border-border">
				<textarea
					ref={textareaRef}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className="flex-1 bg-transparent resize-none outline-none px-4 py-3 text-[15px] max-h-[200px] placeholder:text-muted-foreground"
					rows={1}
				/>
				<button
					type="submit"
					disabled={!input.trim() || isLoading}
					className={`m-2 p-2 rounded-lg transition-colors ${
						input.trim() && !isLoading
							? "bg-primary text-primary-foreground hover:bg-primary/90"
							: "bg-muted text-muted-foreground cursor-not-allowed"
					}`}
				>
					<ArrowUp className="h-4 w-4" />
				</button>
			</div>
		</form>
	);
}
