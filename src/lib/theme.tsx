import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'dark', toggleTheme: () => { } });

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem('ayntrace-theme');
        return (saved === 'light' || saved === 'dark') ? saved : 'dark';
    });

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('ayntrace-theme', theme);

        // Update favicon dynamically
        const favicon = document.querySelector('link[rel="icon"]');
        const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
        const faviconPath = theme === 'dark' ? '/dark-favicon.svg' : '/light-favicon.svg';

        if (favicon) favicon.setAttribute('href', faviconPath);
        if (appleIcon) appleIcon.setAttribute('href', faviconPath);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
