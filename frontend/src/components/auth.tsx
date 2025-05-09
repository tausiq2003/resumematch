import {
    SignedIn,
    SignedOut,
    SignIn,
    SignUp,
    useClerk,
} from "@clerk/clerk-react";
import { Link, useLocation, Navigate, Outlet } from "react-router";
import { motion } from "framer-motion";

export default function Auth() {
    const location = useLocation();
    const isSignIn = location.pathname.includes("/signin");
    const isLogin = location.pathname.includes("/login");
    const { loaded } = useClerk();

    return (
        <div className="h-screen w-screen flex items-center justify-center m-2">
            <div className="bg-white shadow-lg w-min flex flex-col rounded-b-[12px]">
                {loaded && (
                    <div className="flex flex-row flex-nowrap">
                    <Link to="/signin" className="w-[50%]">
                        <button
                            className={`w-full py-3 px-4 font-medium cursor-pointer rounded-t-lg transition-all duration-300 ${
                                isSignIn
                                    ? "pb-6 pt-4 origin-bottom primary-color z-10 -mt-4 text-white"
                                    : "bg-white text-black"
                            }`}
                        >
                            <span className={`${isSignIn ? "text-lg" : ""}`}>
                                Sign in
                            </span>
                        </button>
                    </Link>
                    <Link to="/login" className="w-[50%]">
                        <button
                            className={`w-full py-3 px-4 cursor-pointer rounded-t-lg transition-all duration-300 ${
                                isLogin
                                    ? "pb-6 pt-4 origin-bottom primary-color z-10 -mt-4 text-white"
                                    : "bg-white text-black"
                            }`}
                        >
                            <span className={`${isLogin ? "text-lg" : ""}`}>
                                Login
                            </span>
                        </button>
                    </Link>
                </div>
                )}

                <div>
                        <SignedOut>
                            {isSignIn ? (
                                <SignUp
                                    path="/signin"
                                    signInUrl="/login"
                                    fallbackRedirectUrl="/signin/verify"
                                    appearance={{
                                        elements: {
                                            cardBox: {
                                                borderTopLeftRadius: 0,
                                                borderTopRightRadius: 0,
                                            },
                                            card: {
                                                borderTopLeftRadius: 0,
                                                borderTopRightRadius: 0,
                                            },
                                            footer: {
                                                display: "none",
                                            },
                                        formButtonPrimary: {
                                            backgroundColor: "#2563eb",
                                            "&:hover": {
                                                backgroundColor: "#1d4ed8",
                                            },
                                            transition: "all 0.2s ease-in-out",
                                        },
                                        formFieldInput: {
                                            borderColor: "#e5e7eb",
                                            "&:focus": {
                                                borderColor: "#2563eb",
                                                boxShadow: "0 0 0 1px #2563eb",
                                            },
                                        },
                                        },
                                    }}
                                />
                            ) : isLogin ? (
                                <SignIn
                                    path="/login"
                                    forceRedirectUrl="/dashboard"
                                    fallbackRedirectUrl="/login/verify"
                                    appearance={{
                                        elements: {
                                            cardBox: {
                                                borderTopLeftRadius: 0,
                                                borderTopRightRadius: 0,
                                            },
                                            card: {
                                                borderTopLeftRadius: 0,
                                                borderTopRightRadius: 0,
                                            },
                                            footer: {
                                                display: "none",
                                            },
                                        formButtonPrimary: {
                                            backgroundColor: "#2563eb",
                                            "&:hover": {
                                                backgroundColor: "#1d4ed8",
                                            },
                                            transition: "all 0.2s ease-in-out",
                                        },
                                        formFieldInput: {
                                            borderColor: "#e5e7eb",
                                            "&:focus": {
                                                borderColor: "#2563eb",
                                                boxShadow: "0 0 0 1px #2563eb",
                                            },
                                        },
                                        },
                                    }}
                                />
                            ) : null}
                        </SignedOut>
                    <SignedIn>
                        <Navigate to="/dashboard" replace />
                    </SignedIn>
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
