import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	resolvedTheme: "light" | "dark";
	systemTheme: "light" | "dark";
	themes: string[];
}

const STORAGE_KEY = "synapse-theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({
	children,
	defaultTheme = "system",
}: {
	children: React.ReactNode;
	defaultTheme?: Theme;
}) {
	const [theme, setThemeState] = useState<Theme>(() => {
		if (typeof window === "undefined") return defaultTheme;
		return (localStorage.getItem(STORAGE_KEY) as Theme) || defaultTheme;
	});

	const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => {
		if (typeof window === "undefined") return "light";
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	});

	const resolvedTheme = theme === "system" ? systemTheme : theme;

	useEffect(() => {
		const mql = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = (e: MediaQueryListEvent) => {
			setSystemTheme(e.matches ? "dark" : "light");
		};
		mql.addEventListener("change", handler);
		return () => mql.removeEventListener("change", handler);
	}, []);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
	}, [resolvedTheme]);

	const setTheme = (newTheme: Theme) => {
		setThemeState(newTheme);
		localStorage.setItem(STORAGE_KEY, newTheme);
	};

	return (
		<ThemeContext
			value={{
				theme,
				setTheme,
				resolvedTheme,
				systemTheme,
				themes: ["light", "dark", "system"],
			}}
		>
			{children}
		</ThemeContext>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
