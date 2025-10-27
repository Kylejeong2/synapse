import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface InputBarProps {
	onSend: (message: string) => void;
	isLoading: boolean;
	placeholder?: string;
}

export function InputBar({
	onSend,
	isLoading,
	placeholder = "Type your message...",
}: InputBarProps) {
	const [input, setInput] = useState("");

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

	return (
		<form onSubmit={handleSubmit} className="relative">
			<Textarea
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				disabled={isLoading}
				className="min-h-[60px] pr-12 resize-none"
				rows={2}
			/>
			<Button
				type="submit"
				size="icon"
				disabled={!input.trim() || isLoading}
				className="absolute right-2 bottom-2"
			>
				<Send className="h-4 w-4" />
			</Button>
		</form>
	);
}
