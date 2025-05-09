import { useAuth } from "@clerk/clerk-react";
import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUser } from "../context/UserContext";

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const auth = useAuth();
    const { userData } = useUser();
    const navigate = useNavigate();
    const location = useLocation();

    React.useEffect(() => {
        if (!auth.isLoaded) return;

        const publicRoutes = ['/', '/login', '/signin'];
        const isPublicRoute = publicRoutes.includes(location.pathname);
        const isLoggedIn = !!auth.userId;
        const hasCompleteProfile = userData?.position && userData?.experience_level;

        // Case 1: Not logged in
        if (!isLoggedIn) {
            // Redirect to home page for any protected route
            if (!isPublicRoute) {
                navigate('/');
            }
            return;
        }

        // Case 2: Logged in but incomplete profile
        if (isLoggedIn && !hasCompleteProfile) {
            // Allow access to profile page for profile completion
            if (location.pathname === '/profile') {
                return;
            }
            // Redirect to dashboard for any other protected route
            if (!publicRoutes.includes(location.pathname)) {
                navigate('/dashboard');
            }
            return;
        }

        // Case 3: Logged in with complete profile
        if (isLoggedIn && hasCompleteProfile) {
            // Redirect to dashboard if trying to access public routes
            if (isPublicRoute) {
                navigate('/dashboard');
            }
            return;
        }
    }, [auth.isLoaded, auth.userId, userData, location.pathname, navigate]);

    if (!auth.isLoaded) {
        return <div>Loading...</div>;
    }

    return <>{children}</>;
}
