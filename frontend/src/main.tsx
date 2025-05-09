import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import "./index.css";
import { ThemeProvider } from "./context/ThemeContext";
import { RouterProvider } from "react-router-dom";
import router from "./routes";
import { ClerkProvider } from "@clerk/clerk-react";
import { UserProvider } from "./context/UserContext";
import { dark } from "@clerk/themes";
import { useTheme } from "./context/ThemeContext";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";

function MainApp() {
    const { dark: isDark } = useTheme();
    return (
        <ClerkProvider
            publishableKey={PUBLISHABLE_KEY}
            appearance={isDark ? { baseTheme: dark } : {}}
            afterSignOutUrl="/"
        >
            <UserProvider>
                <RouterProvider router={router} />
            </UserProvider>
        </ClerkProvider>
    );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ThemeProvider>
            <MainApp />
        </ThemeProvider>
    </React.StrictMode>,
);
