import React from "react";
import DashNavBar from "./dashnav";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useUser } from "../context/UserContext";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

export default function EnhanceResume() {
    const [enhancedResume, setEnhancedResume] = React.useState<string>("");
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const { userData } = useUser();
    const { getToken } = useAuth();
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    const handleEnhance = async () => {
        try {
            setLoading(true);
            setError(null);
            const token = await getToken();

            // Get user's resume URL from userData
            if (!userData?.resumeLink) {
                throw new Error(
                    "No resume found. Please upload your resume first.",
                );
            }

            // Call the consolidated endpoint
            const response = await axios.post(
                `${backendUrl}/api/users/enhance-resume`,
                {
                    resumeUrl: userData.resumeLink,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                },
            );

            if (response.data.success && response.data.data.enhancedResume) {
                setEnhancedResume(response.data.data.enhancedResume);
            } else {
                throw new Error("Invalid response format");
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to enhance resume. Please try again.",
            );
            console.error("Error enhancing resume:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        try {
            const token = await getToken();
            const response = await axios.get(
                `${backendUrl}/api/users/enhanced-resume/download`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    responseType: "blob",
                },
            );
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "enhanced-resume.pdf");
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            setError("Failed to download resume. Please try again.");
            console.error("Error downloading resume:", err);
        }
    };

    const components = {
        h1: ({ children, ...props }: any) => (
            <h1 className="text-3xl font-bold mb-4" {...props}>
                {children}
            </h1>
        ),
        h2: ({ children, ...props }: any) => (
            <h2 className="text-2xl font-semibold mb-3" {...props}>
                {children}
            </h2>
        ),
        h3: ({ children, ...props }: any) => (
            <h3 className="text-xl font-semibold mb-2" {...props}>
                {children}
            </h3>
        ),
        p: ({ children, ...props }: any) => (
            <p className="mb-4" {...props}>
                {children}
            </p>
        ),
        ul: ({ children, ...props }: any) => (
            <ul className="list-disc ml-6 mb-4" {...props}>
                {children}
            </ul>
        ),
        li: ({ children, ...props }: any) => (
            <li className="mb-2" {...props}>
                {children}
            </li>
        ),
        strong: ({ children, ...props }: any) => (
            <strong className="font-semibold" {...props}>
                {children}
            </strong>
        ),
        em: ({ children, ...props }: any) => (
            <em className="italic" {...props}>
                {children}
            </em>
        ),
    } as Components;

    return (
        <div className="min-h-screen bg-gray-50">
            <DashNavBar />
            <div className="container mx-auto px-4 py-8">
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold text-gray-800">
                            Enhance Your Resume
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {!userData?.resumeLink && (
                                <div className="text-yellow-600 bg-yellow-50 p-4 rounded-lg">
                                    Please upload your resume first before
                                    enhancing it.
                                </div>
                            )}

                            <Button
                                onClick={handleEnhance}
                                disabled={loading || !userData?.resumeLink}
                                className="w-full black hover:black  text-white font-semibold py-3"
                            >
                                {loading ? "Enhancing..." : "Enhance Resume"}
                            </Button>

                            {error && (
                                <div className="text-red-500 text-sm bg-red-50 p-3 rounded">
                                    {error}
                                </div>
                            )}

                            {enhancedResume && (
                                <div className="space-y-6">
                                    <div className="prose prose-lg max-w-none bg-white rounded-lg shadow-lg p-8">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={components}
                                        >
                                            {enhancedResume}
                                        </ReactMarkdown>
                                    </div>
                                    {/*<Button 
                                        onClick={handleDownload}
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3"
                                    >
                                        <Download className="h-5 w-5" />
                                        Download as PDF
                                    </Button> */}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
            <style>{`
                .prose h1 {
                    font-size: 2.5rem;
                    font-weight: bold;
                    margin-bottom: 2rem;
                    color: #1a1a1a;
                    text-align: center;
                    border-bottom: 3px solid #2563eb;
                    padding-bottom: 1rem;
                }
                .prose h2 {
                    font-size: 1.75rem;
                    font-weight: 600;
                    margin-top: 2rem;
                    margin-bottom: 1rem;
                    color: #1e40af;
                    border-bottom: 2px solid #e5e7eb;
                    padding-bottom: 0.5rem;
                }
                .prose h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    margin-top: 1.5rem;
                    margin-bottom: 0.75rem;
                    color: #2563eb;
                }
                .prose p, .prose li {
                    margin-bottom: 1rem;
                    line-height: 1.8;
                    color: #4a5568;
                    font-size: 1rem;
                }
                .prose ul {
                    margin-left: 1.5rem;
                    margin-bottom: 1.5rem;
                }
                .prose strong {
                    font-weight: 600;
                    color: #1e40af;
                }
                .prose em {
                    font-style: italic;
                    color: #4a5568;
                }
                .prose {
                    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
                }
            `}</style>
        </div>
    );
}
