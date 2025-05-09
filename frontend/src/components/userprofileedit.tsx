import { useAuth } from "@clerk/clerk-react";
import { UserProfile } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import axios from "axios";
import DashNavBar from "./dashnav";
import { useFormContext } from "../context/FormContext";
import Form from "./form";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useTheme } from "../context/ThemeContext";
import { FaFile } from "react-icons/fa";
import { useUser } from "../context/UserContext";
import { useUser as useClerkUser } from "@clerk/clerk-react";
import { Loader2 } from "lucide-react";

export default function UserProfileEdit() {
    const { isLoaded: sessionLoaded, isSignedIn } = useAuth();
    const { getToken } = useAuth();
    const { user, isLoaded: userLoaded } = useAuth();
    const backendUrl = import.meta.env.VITE_BACKEND_URL!;
    const { setShowForm, showForm, handleFormSubmit } = useFormContext();
    const [isUpdating, setIsUpdating] = useState(false);
    const { dark } = useTheme();
    const { userData, loading } = useUser();
    const { user: clerkUser } = useClerkUser();

    const View = () => {
        if (loading) {
            return (
                <div className="space-y-4">
                    <Card
                        className={dark ? "dark:bg-[#333] dark:text-white" : ""}
                    >
                        <CardHeader>
                            <CardTitle>Profile Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="h-4 w-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse"></div>
                                <div className="h-6 w-48 bg-gradient-to-r from-gray-100 to-gray-200 rounded animate-pulse"></div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-4 w-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse"></div>
                                <div className="h-6 w-48 bg-gradient-to-r from-gray-100 to-gray-200 rounded animate-pulse"></div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-4 w-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse"></div>
                                <div className="h-6 w-48 bg-gradient-to-r from-gray-100 to-gray-200 rounded animate-pulse"></div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        // Get data from either userData or Clerk's metadata
        const position =
            userData?.position || clerkUser?.publicMetadata?.position;
        const experience_level =
            userData?.experience_level ||
            clerkUser?.publicMetadata?.experience_level;
        const resumeLink =
            userData?.resumeLink || clerkUser?.publicMetadata?.resumeLink;

        return (
            <div className="space-y-4">
                <Card className={dark ? "dark:bg-[#333] dark:text-white" : ""}>
                    <CardHeader>
                        <CardTitle>Profile Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-sm text-muted-foreground">
                                Position
                            </p>
                            <p className="text-lg font-semibold">
                                {position || "Not specified"}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">
                                Experience Level
                            </p>
                            <p className="text-lg font-semibold">
                                {experience_level || "Not specified"}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">
                                Resume
                            </p>
                            {resumeLink ? (
                                <Button
                                    asChild
                                    variant="outline"
                                    className="w-full"
                                >
                                    <a
                                        href={resumeLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        View Resume
                                    </a>
                                </Button>
                            ) : (
                                <p className="text-lg font-semibold">
                                    Not uploaded
                                </p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowForm(true)}
                            >
                                Edit Profile
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    };

    useEffect(() => {
        if (!sessionLoaded || !userLoaded || !isSignedIn) return;

        const syncProfile = async () => {
            try {
                const token = await getToken();
                const response = await axios.get(
                    `${backendUrl}/api/users/check`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                        withCredentials: true,
                    },
                );

                if (response.status === 200) {
                    // Update Clerk's public metadata
                    await user?.update({
                        publicMetadata: {
                            position: response.data.data.position,
                            experience_level:
                                response.data.data.experience_level,
                            resumeLink: response.data.data.resumeLink,
                        },
                    });
                }
            } catch (err) {
                console.error("Error syncing profile:", err);
            }
        };

        syncProfile();
    }, [getToken, sessionLoaded, userLoaded, isSignedIn, user]);

    if (!sessionLoaded || !userLoaded) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
                    <p className="text-lg text-muted-foreground">
                        Loading your profile...
                    </p>
                </div>
            </div>
        );
    }

    if (!isSignedIn) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="flex flex-col h-screen">
            <DashNavBar />
            {showForm && (
                <Form
                    onClose={() => setShowForm(false)}
                />
            )}
            <div className="w-full h-full">
                <UserProfile
                    appearance={{
                        elements: {
                            rootBox: {
                                minWidth: "100%",
                                width: "100%",
                                height: "100%",
                                borderRadius: "0px",
                            },
                            cardBox: {
                                minWidth: "100%",
                                width: "100%",
                                height: "100%",
                                borderRadius: "0px",
                            },
                            scrollBox: {
                                borderRadius: "0px",
                            },
                        },
                    }}
                >
                    <UserProfile.Page label="account" />
                    <UserProfile.Page
                        label="Resume &amp; others"
                        url="details"
                        labelIcon={<FaFile />}
                    >
                        <View />
                    </UserProfile.Page>
                    <UserProfile.Page label="security" />
                </UserProfile>
            </div>

            {/* Right: Custom Profile */}
        </div>
    );
}
