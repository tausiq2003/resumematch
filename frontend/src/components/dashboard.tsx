import React, { useEffect } from "react";
import { useAuth, useUser as useClerkUser } from "@clerk/clerk-react";
import { Navigate, Link } from "react-router-dom";
import axios from "axios";
import Form from "./form";
import DashNavBar from "./dashnav";
import { useFormContext } from "../context/FormContext";
import JobSearchForm from "./JobSearchForm";
import AnimatedATSCircle from "./svg/AnimatedATSCircle";
import { Button } from "./ui/button";
import Skeleton from "react-loading-skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../context/ThemeContext";
import {
    fetchResumeAnalysis,
    ResumeAnalysisResponse,
} from "../services/jobService";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "./ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ScrollArea } from "./ui/scroll-area";
import { FileText, Loader2 } from "lucide-react";
import { useUser } from "../context/UserContext";
import { useNavigate } from "react-router-dom";

type BackendResponse = {
    data: {
        email: string;
        position: string | null;
        resumeLink: string | null;
        username: string;
        experience_level?: string;
    };
    message?: string;
    statusCode?: number;
    success?: boolean;
};

interface JobSearchHistory {
    id: string;
    date: string;
    region: string;
    country: string;
    results: any[];
    matchStats: {
        high: number;
        mid: number;
        low: number;
    };
}

// Add this interface for job data
interface JobData {
    id: string;
    title: string;
    company: string;
    location: string;
    tier: string;
    match_score: number;
    date_posted: string;
    description: string;
}

const EXPERIENCE_LABELS: Record<string, string> = {
    no_experience: "No experience",
    less_than_3: "Less than 3 years",
    "3_to_5": "3 to 5 years",
    "5_to_10": "5 to 10 years",
    "10_plus": "10+ years",
};

export default function DashBoard() {
    const backendUrl = import.meta.env.VITE_BACKEND_URL!;
    const { getToken } = useAuth();
    const [userData, setUserData] = React.useState<
        BackendResponse["data"] | null
    >(null);
    const [fetchCompleted, setFetchCompleted] = React.useState(false);
    const { showForm, setShowForm, handleFormSubmit } = useFormContext();
    const [searchResults, setSearchResults] = React.useState<any>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [showJobSearch, setShowJobSearch] = React.useState(false);
    const [resumeAnalysis, setResumeAnalysis] = React.useState<
        ResumeAnalysisResponse["data"] | null
    >(null);
    const [analysisLoading, setAnalysisLoading] = React.useState(false);
    const [analysisError, setAnalysisError] = React.useState<string | null>(
        null,
    );
    const [jobSearchData, setJobSearchData] = React.useState<any>(null);
    const [jobSearchLocked, setJobSearchLocked] = React.useState(false);
    const [jobSearchLockedUntil, setJobSearchLockedUntil] =
        React.useState<Date | null>(null);
    const [hasStoredJobs, setHasStoredJobs] = React.useState(false);
    const { dark } = useTheme();
    const {
        userData: userUserData,
        loading: userLoading,
        error: userError,
    } = useUser();
    const navigate = useNavigate();
    const { user: clerkUser } = useClerkUser();
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                duration: 0.5,
            },
        },
    };

    React.useEffect(() => {
        async function fetchUser() {
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
                const data: BackendResponse = response.data;
                setUserData(data.data);

                if (data.data.resumeLink) {
                    setAnalysisLoading(true);
                    setAnalysisError(null);
                    try {
                        const analysis = await fetchResumeAnalysis(token);
                        if (analysis.data) {
                            setResumeAnalysis(analysis.data);
                        } else {
                            setAnalysisError("Invalid analysis data received");
                        }
                    } catch (err) {
                        console.error("Error fetching resume analysis:", err);
                        setAnalysisError("Failed to fetch resume analysis");
                    } finally {
                        setAnalysisLoading(false);
                    }
                }
            } catch (err) {
                console.error("Error fetching data:", err);
                setError("Failed to fetch user data");
            } finally {
                setFetchCompleted(true);
                setIsInitialLoad(false);
            }
        }
        fetchUser();
    }, [getToken, backendUrl]);

    React.useEffect(() => {
        async function fetchJobSearchData() {
            const token = await getToken();
            try {
                const response = await axios.get(
                    `${backendUrl}/api/users/job-search-latest`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                        withCredentials: true,
                    },
                );
                const data = response.data;
                if (data && data.lockedUntil) {
                    setJobSearchLockedUntil(new Date(data.lockedUntil));
                    setJobSearchLocked(new Date() < new Date(data.lockedUntil));
                } else {
                    setJobSearchLocked(false);
                    setJobSearchLockedUntil(null);
                }
                setHasStoredJobs(
                    !!data &&
                        !!data.searchData &&
                        Array.isArray(data.searchData.jobs) &&
                        data.searchData.jobs.length > 0,
                );
                setJobSearchData(data);
            } catch (err) {
                setJobSearchLocked(false);
                setJobSearchLockedUntil(null);
                setHasStoredJobs(false);
                setJobSearchData(null);
            }
        }
        fetchJobSearchData();
    }, []);

    // Timer to update lock state when lock expires
    React.useEffect(() => {
        if (!jobSearchLocked || !jobSearchLockedUntil) return;
        const now = new Date();
        const msUntilUnlock = jobSearchLockedUntil.getTime() - now.getTime();
        if (msUntilUnlock > 0) {
            const timer = setTimeout(() => {
                setJobSearchLocked(false);
            }, msUntilUnlock);
            return () => clearTimeout(timer);
        }
    }, [jobSearchLocked, jobSearchLockedUntil]);

    const handleJobSearch = async (formData: any) => {
        try {
            const token = await getToken();
            const response = await axios.post(
                `${backendUrl}/api/users/search-jobs`,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    withCredentials: true,
                },
            );
            setSearchResults(response.data.data);
            setShowJobSearch(false);
            // Set lock for 12 hours
            const lockedUntil = new Date();
            lockedUntil.setHours(lockedUntil.getHours() + 12);
            setJobSearchLockedUntil(lockedUntil);
        } catch (err) {
            setError("Failed to search for jobs.");
            console.error("Error searching jobs:", err);
        }
    };

    useEffect(() => {
        if (userError) {
            navigate("/error", {
                state: {
                    error: userError,
                    message:
                        "Failed to load user data. Please try again later.",
                },
            });
        }
    }, [userError, navigate]);

    if (isInitialLoad || userLoading) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-h-screen bg-background flex items-center justify-center"
            >
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                    <p className="text-lg text-muted-foreground">
                        Loading your dashboard...
                    </p>
                </div>
            </motion.div>
        );
    }

    if (!userUserData) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <h1 className="text-2xl font-bold mb-4">Error</h1>
                <p className="text-gray-600">
                    Unable to load user data. Please try again later.
                </p>
                <Button
                    onClick={() => window.location.reload()}
                    className="mt-4"
                >
                    Retry
                </Button>
            </div>
        );
    }

    if (!fetchCompleted) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-h-screen bg-background"
            >
                <div className="container mx-auto px-4 py-8">
                    <div className="space-y-4">
                        <div className="h-8 bg-gradient-to-r from-blue-200 to-blue-300 rounded animate-pulse w-1/3"></div>
                        <div className="h-32 bg-gradient-to-r from-blue-100 to-blue-200 rounded animate-pulse"></div>
                        <div className="h-32 bg-gradient-to-r from-blue-100 to-blue-200 rounded animate-pulse"></div>
                    </div>
                </div>
            </motion.div>
        );
    }

    if (!userData?.resumeLink || !userData?.position) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-h-screen bg-background"
            >
                <DashNavBar />
                <div className="container mx-auto px-4 py-8">
                    <Card className="max-w-2xl mx-auto">
                        <CardHeader>
                            <CardTitle>Complete Your Profile</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-lg mb-4">
                                Hello{" "}
                                {clerkUser?.username ||
                                    clerkUser?.firstName ||
                                    "User"}
                                , to continue using ResumeMatch, please complete
                                your profile by filling out the form below.
                            </p>
                            <Button
                                onClick={() => setShowForm(true)}
                                className="w-full"
                            >
                                Complete Profile
                            </Button>
                        </CardContent>
                    </Card>
                    {showForm && (
                        <Form
                            handleFormSubmit={handleFormSubmit}
                            onClose={() => setShowForm(false)}
                        />
                    )}
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`min-h-screen ${dark ? "dark bg-black" : "bg-[#f0f0f0]"}`}
        >
            <DashNavBar />
            <div className="container mx-auto px-4 py-8">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                >
                    {/* Profile Section */}
                    <motion.div
                        variants={itemVariants}
                        className="lg:col-span-1"
                    >
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>Profile Overview</span>
                                    <Badge
                                        variant="outline"
                                        className="text-sm"
                                    >
                                        {EXPERIENCE_LABELS[
                                            userData?.experience_level ?? ""
                                        ] || "Not specified"}
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            Username
                                        </p>
                                        <p className="text-lg font-semibold">
                                            {clerkUser?.username ||
                                                clerkUser?.firstName ||
                                                "User"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">
                                            Position
                                        </p>
                                        <p className="text-lg font-semibold">
                                            {userData?.position}
                                        </p>
                                    </div>
                                    {userData?.resumeLink && (
                                        <Button
                                            asChild
                                            className="w-full"
                                            variant="outline"
                                        >
                                            <a
                                                href={userData.resumeLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                View Resume
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* ATS Score Section */}
                    <motion.div
                        variants={itemVariants}
                        className="lg:col-span-2"
                    >
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle>Resume Analysis</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="flex flex-col items-center">
                                        <p
                                            className="text-2xl font-bold mb-4"
                                            style={{ color: "#43e97b" }}
                                        >
                                            ATS Score
                                        </p>
                                        {analysisLoading ? (
                                            <Skeleton
                                                height={120}
                                                width={120}
                                                circle
                                            />
                                        ) : analysisError ? (
                                            <div className="text-red-400">
                                                {analysisError}
                                            </div>
                                        ) : resumeAnalysis ? (
                                            <AnimatedATSCircle
                                                score={resumeAnalysis.ats_score}
                                            />
                                        ) : (
                                            <Skeleton
                                                height={120}
                                                width={120}
                                                circle
                                            />
                                        )}
                                    </div>
                                    <div className="space-y-4">
                                        <Tabs
                                            defaultValue="strengths"
                                            className="w-full"
                                        >
                                            <TabsList className="grid grid-cols-3">
                                                <TabsTrigger value="strengths">
                                                    Strengths
                                                </TabsTrigger>
                                                <TabsTrigger value="weaknesses">
                                                    Weaknesses
                                                </TabsTrigger>
                                                <TabsTrigger value="suggestions">
                                                    Suggestions
                                                </TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="strengths">
                                                <ScrollArea className="h-[200px]">
                                                    <ul className="list-disc list-inside space-y-2">
                                                        {resumeAnalysis?.strengths?.map(
                                                            (
                                                                s: string,
                                                                i: number,
                                                            ) => (
                                                                <li
                                                                    key={i}
                                                                    className="text-green-500"
                                                                >
                                                                    {s}
                                                                </li>
                                                            ),
                                                        )}
                                                    </ul>
                                                </ScrollArea>
                                            </TabsContent>
                                            <TabsContent value="weaknesses">
                                                <ScrollArea className="h-[200px]">
                                                    <ul className="list-disc list-inside space-y-2">
                                                        {resumeAnalysis?.weaknesses?.map(
                                                            (
                                                                w: string,
                                                                i: number,
                                                            ) => (
                                                                <li
                                                                    key={i}
                                                                    className="text-red-500"
                                                                >
                                                                    {w}
                                                                </li>
                                                            ),
                                                        )}
                                                    </ul>
                                                </ScrollArea>
                                            </TabsContent>
                                            <TabsContent value="suggestions">
                                                <ScrollArea className="h-[200px]">
                                                    {resumeAnalysis?.suggestions &&
                                                        Object.entries(
                                                            resumeAnalysis.suggestions,
                                                        ).map(
                                                            ([
                                                                cat,
                                                                suggestions,
                                                            ]: [
                                                                string,
                                                                any,
                                                            ]) => (
                                                                <div
                                                                    key={cat}
                                                                    className="mb-4"
                                                                >
                                                                    <h4 className="font-semibold capitalize mb-2 text-blue-500">
                                                                        {cat}:
                                                                    </h4>
                                                                    <ul className="list-disc list-inside space-y-2">
                                                                        {Array.isArray(
                                                                            suggestions,
                                                                        ) &&
                                                                            suggestions.map(
                                                                                (
                                                                                    s,
                                                                                    i,
                                                                                ) => (
                                                                                    <li
                                                                                        key={
                                                                                            i
                                                                                        }
                                                                                        className="text-blue-400"
                                                                                    >
                                                                                        {
                                                                                            s
                                                                                        }
                                                                                    </li>
                                                                                ),
                                                                            )}
                                                                    </ul>
                                                                </div>
                                                            ),
                                                        )}
                                                </ScrollArea>
                                            </TabsContent>
                                        </Tabs>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Job Search Section */}
                    <motion.div
                        variants={itemVariants}
                        className="lg:col-span-3"
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>Job Search</span>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <Badge
                                                    variant={
                                                        jobSearchLocked
                                                            ? "destructive"
                                                            : "default"
                                                    }
                                                >
                                                    {jobSearchLocked
                                                        ? "Locked"
                                                        : "Available"}
                                                </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                {jobSearchLocked
                                                    ? `Next search available in ${Math.ceil((jobSearchLockedUntil!.getTime() - new Date().getTime()) / (1000 * 60 * 60))} hours`
                                                    : "Ready to search for jobs"}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col md:flex-row gap-4 cursor-pointer">
                                    {!jobSearchLocked && (
                                        <Button
                                            onClick={() =>
                                                setShowJobSearch(true)
                                            }
                                            className="w-full md:w-auto cursor-pointer"
                                        >
                                            Search Jobs
                                        </Button>
                                    )}
                                    {jobSearchLocked && hasStoredJobs && (
                                        <Button
                                            asChild
                                            className="w-full md:w-auto cursor-pointer"
                                        >
                                            <Link
                                                to="/jobs"
                                                state={{
                                                    searchResults:
                                                        jobSearchData
                                                            ?.searchData
                                                            ?.jobs || [],
                                                }}
                                            >
                                                View Previous Results
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                    <motion.div
                        variants={itemVariants}
                        className="lg:col-span-3"
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>Enhance Resume</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col md:flex-row gap-4">
                                    <Button
                                        asChild
                                        className="w-full md:w-auto"
                                    >
                                        <Link to="/enhance-resume">
                                            <FileText className="h-4 w-4" />
                                            Enhance Resume
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </motion.div>
            </div>

            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    >
                        <Form
                            onClose={() => setShowForm(false)}
                            handleFormSubmit={handleFormSubmit}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showJobSearch && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className={`${dark ? "bg-[#333]" : "bg-white"} rounded-lg p-8 max-w-2xl w-full`}
                        >
                            <JobSearchForm
                                onSearchResults={handleJobSearch}
                                onClose={() => setShowJobSearch(false)}
                                isLocked={jobSearchLocked}
                                lockedUntil={jobSearchLockedUntil}
                                hasJobs={!!searchResults}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
