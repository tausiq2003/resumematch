import axios from "axios";

const API_URL = "http://localhost:8000/api";

export interface JobSearchParams {
    country: string;
    region: string;
    posted_since: string;
    preferred_keywords?: string;
    excluded_keywords?: string;
}

interface ErrorResponse {
    message: string;
    [key: string]: any;
}

export interface ResumeAnalysisResponse {
    statusCode: number;
    data: {
        analysis: {
            metrics: {
                word_count: number;
                skills_count: number;
                grammar_score: number;
                weak_word_ratio: number;
                experience_level: string;
                action_verb_ratio: number;
                readability_score: number;
                professional_tone_score: number;
                quantified_achievements_ratio: number;
            };
            ats_score: number;
            strengths: string[];
            subscores: {
                content: number;
                section: number;
                keywords: number;
                experience: number;
                formatting: number;
            };
            weaknesses: string[];
            suggestions: {
                content: string[];
                formatting: string[];
                optimization: string[];
            };
            section_scores: {
                skills_count: number;
                skills_presence: number;
                education_presence: number;
                experience_presence: number;
                contact_info_presence: number;
            };
            experience_level: string;
            formatting_scores: {
                has_dates: number;
                has_tables: number;
                has_white_space: number;
                has_action_verbs: number;
                has_bullet_points: number;
                has_professional_font: number;
                has_complex_formatting: number;
                has_consistent_formatting: number;
                has_quantified_achievements: number;
            };
        };
        enhanced_resume: string;
    };
    message: string;
    success: boolean;
}

export const searchJobs = async (
    params: JobSearchParams,
    token: string | null,
) => {
    try {
        console.log("Starting job search with params:", params);
        console.log(
            "Authentication token obtained:",
            token ? "Token received" : "No token",
        );

        const response = await axios.post(
            `${API_URL}/users/fetch-jobs`,
            params,
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
            },
        );

        console.log("Job search response:", response.data);
        return response.data;
    } catch (error) {
        console.error("Error searching jobs:", error);
        if (error && typeof error === "object" && "response" in error) {
            const axiosError = error as {
                response?: { status?: number; statusText?: string; data?: any };
            };
            console.error("Axios error details:", {
                status: axiosError.response?.status,
                statusText: axiosError.response?.statusText,
                data: axiosError.response?.data,
            });
        }
        throw error;
    }
};

export const fetchResumeAnalysis = async (
    token: string | null,
): Promise<ResumeAnalysisResponse> => {
    try {
        console.log(
            "Fetching resume analysis from:",
            `${API_URL}/users/analyze-resume`,
        );
        const response = await axios.post<ResumeAnalysisResponse>(
            `${API_URL}/users/analyze-resume`,
            {},
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                withCredentials: true,
            },
        );
        console.log("Resume analysis response:", response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching resume analysis:", error);
        if (axios.isAxiosError(error)) {
            console.error("Axios error details:", {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
            });
        }
        throw error;
    }
};
