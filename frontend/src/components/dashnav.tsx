import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { useTheme } from "../context/ThemeContext";
import { Moon, Sun, User } from "lucide-react";
import { SignOutButton } from "@clerk/clerk-react";

export default function DashNavBar() {
    const { dark, toggle } = useTheme();

    return (
        <nav
            className={
                dark
                    ? "w-full border-b border-[#222] bg-[#222] shadow-sm sticky top-0 z-50"
                    : "w-full border-b border-gray-200 bg-white shadow-sm sticky top-0 z-50"
            }
        >
            <div className="px-6 flex items-center justify-between h-16">
                <div className="flex items-center gap-4">
                    <Link
                        to="/dashboard"
                        className={
                            dark
                                ? "text-2xl font-extrabold tracking-tight text-[#f0f0f0]"
                                : "text-2xl font-extrabold tracking-tight text-[#222]"
                        }
                    >
                        Resume Match
                    </Link>
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggle}
                        className={
                            dark
                                ? "text-[#f0f0f0] hover:text-white"
                                : "text-[#222] hover:text-black"
                        }
                        aria-label="Toggle dark mode"
                    >
                        {dark ? (
                            <Sun className="h-5 w-5" />
                        ) : (
                            <Moon className="h-5 w-5" />
                        )}
                    </Button>
                    <Link to="/profile" aria-label="Profile">
                        <Button variant="ghost" size="icon">
                            <User className="h-5 w-5" />
                        </Button>
                    </Link>
                    <Button asChild variant="outline" className="ml-2">
                        <SignOutButton>Sign-out</SignOutButton>
                    </Button>
                </div>
            </div>
        </nav>
    );
}
