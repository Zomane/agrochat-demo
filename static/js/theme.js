const THEME_KEY = "agrochat.theme";
const THEMES = new Set(["light", "dark"]);

export function initializeTheme(themeButton) {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const theme = THEMES.has(savedTheme) ? savedTheme : "light";
    applyTheme(theme, themeButton);
    return theme;
}

export function toggleTheme(themeButton) {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme, themeButton);
    localStorage.setItem(THEME_KEY, nextTheme);
}

function applyTheme(theme, themeButton) {
    document.documentElement.dataset.theme = theme;
    themeButton.setAttribute(
        "aria-label",
        theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему",
    );
}
