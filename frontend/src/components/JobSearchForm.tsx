import React from "react";
import { searchJobs, JobSearchParams } from "../services/jobService";
import { useAuth } from "@clerk/clerk-react";
import { CountryDropdown, RegionDropdown } from "react-country-region-selector";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { Label } from "./ui/label";
import { useTheme } from "../context/ThemeContext";
import { motion } from "framer-motion";
import Skeleton from "react-loading-skeleton";
import { X } from "lucide-react";

interface FormValues {
    region: string;
    country: string;
    posted_since: string;
    preferred_keywords?: string;
    excluded_keywords?: string;
}

interface SearchResponse {
    data: any[];
    total: number;
    page: number;
    size: number;
}

interface JobSearchFormProps {
    onSearchResults: (data: SearchResponse) => void;
    onClose: () => void;
}

const JobSearchForm = ({
    onSearchResults,
    onClose,
    isLocked = false,
    lockedUntil = null,
    hasJobs = false,
}: JobSearchFormProps & {
    isLocked?: boolean;
    lockedUntil?: Date | null;
    hasJobs?: boolean;
}) => {
    const { getToken } = useAuth();
    const [loading, setLoading] = React.useState(false);
    const [country, setCountry] = React.useState<string>("India");
    const [region, setRegion] = React.useState<string>("");
    const [postedSince, setPostedSince] = React.useState<string>("week");
    const [preferredKeywords, setPreferredKeywords] =
        React.useState<string>("");
    const [excludedKeywords, setExcludedKeywords] = React.useState<string>("");
    const navigate = useNavigate();
    const { dark } = useTheme();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Submitting job search form");
        const values: FormValues = {
            country,
            region,
            posted_since: postedSince,
            preferred_keywords: preferredKeywords,
            excluded_keywords: excludedKeywords,
        };
        console.log("Form values:", values);
        try {
            setLoading(true);
            const token = await getToken();
            console.log("Calling searchJobs service...");
            const response = await searchJobs(values, token);
            console.log("Search results received:", response);
            onSearchResults(response);
            // Navigate to jobs page after successful search
            navigate("/jobs", { state: { searchResults: response } });
        } catch (error) {
            console.error("Error in form submission:", error);
        } finally {
            setLoading(false);
        }
    };

    console.log("JobSearchForm: loading=", loading, "isLocked=", isLocked);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#333] p-6 rounded-lg shadow-lg relative"
        >
            <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 cursor-pointer"
                aria-label="Close"
            >
                <X className="h-5 w-5" />
            </button>
            <form
                onSubmit={handleSubmit}
                className="space-y-6 pt-4 pb-12 relative"
            >
                <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <CountryDropdown
                        value={country}
                        id="country"
                        name="country"
                        className="w-full p-2 border rounded-md dark:bg-[#444] dark:text-white"
                        onChange={(val: string) => setCountry(val)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <RegionDropdown
                        country={country}
                        value={region}
                        name="region"
                        id="region"
                        className="w-full p-2 border rounded-md dark:bg-[#444] dark:text-white"
                        onChange={(val: string) => setRegion(val)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="posted_since">Since</Label>
                    <Select value={postedSince} onValueChange={setPostedSince}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select time period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="month">A month</SelectItem>
                            <SelectItem value="week">A week</SelectItem>
                            <SelectItem value="3days">3 days</SelectItem>
                            <SelectItem value="today">1 day</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="preferred_keywords">
                        Preferred Keywords (Comma separated values)
                    </Label>
                    <Input
                        id="preferred_keywords"
                        placeholder="web developer, senior manager"
                        value={preferredKeywords}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setPreferredKeywords(e.target.value)
                        }
                        className="dark:bg-[#444] dark:text-white"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="excluded_keywords">
                        Excluded Keywords (Comma separated values)
                    </Label>
                    <Input
                        id="excluded_keywords"
                        placeholder="javascript, python"
                        value={excludedKeywords}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setExcludedKeywords(e.target.value)
                        }
                        className="dark:bg-[#444] dark:text-white"
                    />
                </div>
                <div className="flex justify-end items-center mt-8">
                    {isLocked && hasJobs ? (
                        <Button
                            asChild
                            className="primary-color text-white px-6 py-3 rounded-md text-lg font-semibold transition hover:scale-105 border-none cursor-pointer"
                        >
                            <Link to="/jobs">View Jobs</Link>
                        </Button>
                    ) : (
                        <Button
                            type="submit"
                            className="primary-color text-white px-6 py-3 rounded-md text-lg font-semibold transition hover:scale-105 border-none cursor-pointer"
                            disabled={loading || isLocked}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg
                                        className="animate-spin h-5 w-5 text-white"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8v8z"
                                        ></path>
                                    </svg>
                                    Searching...
                                </span>
                            ) : (
                                "Search Jobs"
                            )}
                        </Button>
                    )}
                </div>
            </form>
            {isLocked && lockedUntil && (
                <div className="text-center text-yellow-500 mt-2">
                    You can search again in{" "}
                    {Math.ceil(
                        (lockedUntil.getTime() - Date.now()) / (1000 * 60 * 60),
                    )}{" "}
                    hours.
                </div>
            )}
        </motion.div>
    );
};

export default JobSearchForm;
