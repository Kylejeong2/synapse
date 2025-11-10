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
			<div className="relative flex items-end bg-white dark:bg-[#2f2f2f] rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700">
				<textarea
					ref={textareaRef}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className="flex-1 bg-transparent resize-none outline-none px-4 py-3 text-[15px] max-h-[200px] placeholder:text-gray-500 dark:placeholder:text-gray-400"
					rows={1}
				/>
				<button
					type="submit"
					disabled={!input.trim() || isLoading}
					className={`m-2 p-2 rounded-lg transition-colors ${
						input.trim() && !isLoading
							? "bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
							: "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
					}`}
				>
					<ArrowUp className="h-4 w-4" />
				</button>
			</div>
		</form>
	);
}
