import { Request, Response } from "express";
import axios from "axios";
import { z } from "zod";
import { db } from "../db";
import { users, resumeAnalysis, jobSearchResults } from "../models/users.models";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { eq, and } from "drizzle-orm";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import FormData from "form-data";
import { ATSResumeScorer } from '../../backend2/src/ats_scorer';

// Environment variables validation
const BACKEND2_URL = process.env.BACKEND2_URL || "http://localhost:5000";
const MAX_RETRIES = Number(process.env.API_MAX_RETRIES || 3);
const RETRY_DELAY_MS = Number(process.env.API_RETRY_DELAY_MS || 1000);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 120000); // 2 minutes timeout
const JOB_SEARCH_LOCK_HOURS = 12;

// Validation schema for job search
const jobSearchSchema = z.object({
    country: z.string().min(1, "Country is required"),
    region: z.string().min(1, "Region is required"),
    posted_since: z.string().min(1, "Posted since period is required"),
    preferred_keywords: z.string().optional(),
    excluded_keywords: z.string().optional(),
});

// Add CloudFront URL helper
const getCloudFrontUrl = (key: string) => {
    const cloudfrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
    if (!cloudfrontDomain) throw new ApiError(500, "CloudFront domain not set");
    return `https://${cloudfrontDomain}/${key}`;
};

/**
 * Helper function to convert a readable stream to buffer
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
    });
}

/**
 * Controller function to search for jobs based on user position and resume
 */
export const fetchJobs = asyncHandler(async (req: Request, res: Response) => {
    console.log("Received job search request:", req.body);

    try {
        // Validate user authentication
        const userId = req.user?.id;
        if (!userId) {
            throw new ApiError(401, "Unauthorized: Missing user ID");
        }

        // Get user data including position and resume link
        const userData = await db
            .select()
            .from(users)
            .where(eq(users.clerkId, userId));

        if (userData.length === 0) {
            throw new ApiError(
                404,
                "User data not found. Please update your position and upload a resume.",
            );
        }

        // Get job position from user data
        const jobPosition = userData[0].position;
        if (!jobPosition?.trim()) {
            throw new ApiError(400, "Job position cannot be empty");
        }

        // Validate request body
        const validatedData = jobSearchSchema.parse(req.body);
        console.log("Validated data:", validatedData);

        // Get resume CloudFront URL
        const pdfKey = userData[0].resumeLink;
        if (!pdfKey) {
            throw new ApiError(
                404,
                "Resume not found. Please upload your resume first.",
            );
        }
        const resumeUrl = getCloudFrontUrl(pdfKey);

        // Download resume from CloudFront
        const response = await axios.get(resumeUrl, { responseType: "stream" });
        const stream = response.data as Readable;
        const buffer = await streamToBuffer(stream);

        // Create multipart form data
        const formData = new FormData();
        formData.append("job_position", jobPosition);
        formData.append("country", validatedData.country);
        formData.append("region", validatedData.region);
        formData.append("posted_since", validatedData.posted_since);

        // Add optional parameters if provided
        if (validatedData.preferred_keywords) {
            formData.append(
                "preferred_keywords",
                validatedData.preferred_keywords,
            );
        }
        if (validatedData.excluded_keywords) {
            formData.append(
                "excluded_keywords",
                validatedData.excluded_keywords,
            );
        }

        // Add resume file as multipart form-data
        formData.append("resume", buffer, {
            filename: `${userId}-resume.pdf`,
            contentType: "application/pdf",
        });

        // Call backend2 API with retry logic
        console.log("Sending request to backend2...");
        const backendResponse = await retryRequest(async () => {
            try {
                return await axios.post(
                    `${BACKEND2_URL}/search-jobs`,
                    formData,
                    {
                headers: {
                    ...formData.getHeaders(),
                        },
                        timeout: REQUEST_TIMEOUT_MS,
                    },
                );
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    console.error("Backend2 API error details:", {
                        status: error.response?.status,
                        statusText: error.response?.statusText,
                        data: error.response?.data,
                        message: error.message,
                        code: error.code,
                    });
                }
                throw error;
            }
        });

        console.log("Backend2 API response status:", backendResponse.status);
        console.log(
            "Backend2 API response data:",
            JSON.stringify(backendResponse.data, null, 2),
        );

        // Store job search results in database
        const lockedUntil = new Date();
        lockedUntil.setHours(lockedUntil.getHours() + JOB_SEARCH_LOCK_HOURS);

        await db
            .insert(jobSearchResults)
            .values({
                userId,
                searchData: backendResponse.data,
                isLocked: true,
                lockedUntil,
            })
            .onConflictDoUpdate({
                target: [jobSearchResults.userId],
                set: {
                    searchData: backendResponse.data,
                    isLocked: true,
                    lockedUntil,
                    updatedAt: new Date(),
                },
            });

        // Return jobs data to client
        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    backendResponse.data,
                    "Fetched jobs successfully",
                ),
            );
    } catch (error: any) {
        console.error("Error in fetchJobs:", error);

        if (error instanceof z.ZodError) {
            throw new ApiError(400, "Invalid input data");
        }

        if (axios.isAxiosError(error)) {
            const status = error.response?.status || 500;
            const message =
                error.response?.data?.message ||
                "Error contacting job search service";

            throw new ApiError(status, message);
        }

        // Handle ApiError
        if (error instanceof ApiError) {
            throw new ApiError(error.statusCode, error.message);
        }

        // Generic error
        throw new ApiError(500, "Internal server error");
    }
});

export const analyzeResume = asyncHandler(
    async (req: Request, res: Response) => {
        console.log("Starting resume analysis...");
        // 1. Get user info
        const userId = req.user?.id;
        if (!userId) {
            console.error("No user ID found in request");
            throw new ApiError(401, "Unauthorized: Missing user ID");
        }
        console.log("User ID:", userId);

        // 2. Get user data from DB
        const userData = await db
            .select()
            .from(users)
            .where(eq(users.clerkId, userId));
        if (userData.length === 0) {
            console.error("No user data found for ID:", userId);
            throw new ApiError(
                404,
                "User data not found. Please update your position and upload a resume.",
            );
        }
        const { resumeLink, experience_level } = userData[0];
        console.log("User data:", { resumeLink, experience_level });

        if (!resumeLink) {
            console.error("No resume link found for user:", userId);
            throw new ApiError(
                404,
                "Resume not found. Please upload your resume first.",
            );
        }
        if (!experience_level) {
            console.error("No experience level set for user:", userId);
            throw new ApiError(400, "Experience level not set for user");
        }

        // Check if we have a recent analysis for the same resume
        const existingAnalysis = await db
            .select()
            .from(resumeAnalysis)
            .where(eq(resumeAnalysis.userId, userId))
            .orderBy(resumeAnalysis.updatedAt)
            .limit(1);

        if (existingAnalysis.length > 0) {
            const lastAnalysis = existingAnalysis[0];
            const lastUpdated = new Date(lastAnalysis.updatedAt);
            const now = new Date();
            const hoursSinceLastUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
            // Only return cached analysis if resumeLink matches
            if (lastAnalysis.resumeLink === resumeLink && hoursSinceLastUpdate < 24) {
                console.log("Returning cached analysis for same resume");
                return res
                    .status(200)
                    .json(
                        new ApiResponse(
                            200,
                            lastAnalysis.analysisData,
                            "Resume analysis retrieved from cache",
                        ),
                    );
            }
        }

        // 3. Download resume from CloudFront
        console.log("Getting CloudFront URL for resume");
        const resumeUrl = getCloudFrontUrl(resumeLink);
        console.log("Resume URL:", resumeUrl);

        try {
            console.log("Downloading resume from CloudFront");
            const response = await axios.get(resumeUrl, { responseType: "stream" });
            const stream = response.data as Readable;
            const buffer = await streamToBuffer(stream);
            console.log("Resume downloaded successfully");

            // 4. Send to backend2/analyze-resume
            console.log("Creating form data for analysis");
            const formData = new FormData();
            formData.append("experience_level", experience_level);
            formData.append("resume", buffer, {
                filename: `${userId}-resume.pdf`,
                contentType: "application/pdf",
            });

            console.log("Sending request to backend2");
            const backendResponse = await axios.post(
                `${BACKEND2_URL}/analyze-resume`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                    },
                    timeout: REQUEST_TIMEOUT_MS,
                },
            );
            console.log("Backend2 response received");

            // Transform the data structure to match frontend expectations
            const transformedData = {
                ...backendResponse.data.analysis,
                enhanced_resume: backendResponse.data.enhanced_resume
            };

            // Store the analysis in the database with resumeLink
            console.log("Storing analysis in database");
            await db
                .insert(resumeAnalysis)
                .values({
                    userId,
                    resumeLink,
                    analysisData: transformedData,
                })
                .onConflictDoUpdate({
                    target: [resumeAnalysis.userId],
                    set: {
                        resumeLink,
                        analysisData: transformedData,
                        updatedAt: new Date(),
                    },
                });

            console.log("Analysis stored successfully");
            return res
                .status(200)
                .json(
                    new ApiResponse(
                        200,
                        transformedData,
                        "Resume analysis successful",
                    ),
                );
        } catch (error) {
            console.error("Error in resume analysis:", error);
            if (axios.isAxiosError(error)) {
                console.error("Axios error details:", {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    message: error.message,
                });
                const status = error.response?.status || 500;
                const message =
                    error.response?.data?.message ||
                    "Error contacting resume analysis service";
                throw new ApiError(status, message);
            }
            throw new ApiError(500, "Internal server error");
        }
    },
);

/**
 * Helper function to retry API requests
 */
async function retryRequest<T>(
    fn: () => Promise<T>,
    retries = MAX_RETRIES,
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) {
            console.error("All retry attempts failed. Last error:", error);
            throw error;
        }

        console.log(`Retrying request. Attempts remaining: ${retries - 1}`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return retryRequest(fn, retries - 1);
    }
}

export const enhanceResume = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            throw new ApiError(401, "Unauthorized: Missing user ID");
        }

        // Get user's resume from database
        const user = await db.select().from(users).where(eq(users.clerkId, userId)).limit(1);

        if (!user[0]?.resumeLink) {
            throw new ApiError(404, "Resume not found. Please upload your resume first.");
        }

        // Get CloudFront URL for the resume
        const resumeUrl = getCloudFrontUrl(user[0].resumeLink);

        // Send to backend2 for enhancement
        const enhancementResponse = await axios.post(
            `${BACKEND2_URL}/api/enhance-resume`,
            {
                resumeUrl: resumeUrl
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!enhancementResponse.data?.success) {
            throw new ApiError(500, "Failed to enhance resume: Invalid response from enhancement service");
        }

        return res.status(200).json({
            success: true,
            data: {
                enhancedResume: enhancementResponse.data.data.enhancedResume
            }
        });
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        console.error("Error enhancing resume:", error);
        throw new ApiError(500, "Failed to enhance resume");
    }
});

// Helper function to generate enhanced resume markdown
function generateEnhancedResumeMarkdown(result: any): string {
    const { strengths, weaknesses, suggestions, metrics } = result;
    
    let markdown = `# Enhanced Resume\n\n`;
    
    // Add strengths
    markdown += `## Strengths\n\n`;
    strengths.forEach((strength: string) => {
        markdown += `- ${strength}\n`;
    });
    
    // Add weaknesses
    markdown += `\n## Areas for Improvement\n\n`;
    weaknesses.forEach((weakness: string) => {
        markdown += `- ${weakness}\n`;
    });
    
    // Add suggestions
    markdown += `\n## Suggestions\n\n`;
    Object.entries(suggestions).forEach(([category, items]: [string, any]) => {
        markdown += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
        items.forEach((item: string) => {
            markdown += `- ${item}\n`;
        });
    });
    
    // Add metrics
    markdown += `\n## Resume Metrics\n\n`;
    Object.entries(metrics).forEach(([key, value]: [string, any]) => {
        markdown += `- ${key.replace(/_/g, ' ').toUpperCase()}: ${value}\n`;
    });
    
    return markdown;
}

// Helper function to convert markdown to PDF
async function convertMarkdownToPdf(markdown: string): Promise<Buffer> {
    // You'll need to implement this function using a library like puppeteer or wkhtmltopdf
    // This is a placeholder implementation
    throw new Error("PDF conversion not implemented");
}
