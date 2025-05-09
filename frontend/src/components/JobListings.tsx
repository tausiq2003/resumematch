import React from "react";
import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import DashNavBar from "./dashnav";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import Skeleton from "react-loading-skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../context/ThemeContext";
import { Search, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";

interface JobData {
    id: string;
    title: string;
    company: string;
    tier: string;
    match_score: number;
    date_posted: string;
    url: string;
}

type SortField = "title" | "company" | "tier" | "match_score" | "date_posted";
type SortOrder = "asc" | "desc";

const ITEMS_PER_PAGE = 10;

function mapJobData(rawJobs: any[]): JobData[] {
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ];
    function recieveDate(date: Date) {
        const monthName = monthNames[date.getMonth()];
        const formattedDate = String(date.getDate()).padStart(2, "0");
        return `${monthName} ${formattedDate}`;
    }
    const date = new Date();
    const fallbackDate = recieveDate(date);
    return (rawJobs || [])
        .filter((job) => !!job.display_title)
        .map((job, idx) => ({
            id: String(idx),
            title: job.display_title,
            company: job.display_company || "Confidential",
            tier: job.tier || "Unknown",
            match_score:
                job.combined_score !== undefined
                    ? Math.round(job.combined_score * 100)
                    : 0,
            date_posted: job.date_posted || fallbackDate,
            url:
                (job.apply_options && job.apply_options[0] && job.apply_options[0].apply_link) ||
                "#",
        }));
}

export default function JobListings() {
    const [jobs, setJobs] = React.useState<JobData[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [sortField, setSortField] = React.useState<SortField>("match_score");
    const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc");
    const { getToken } = useAuth();
    const backendUrl = import.meta.env.VITE_BACKEND_URL!;
    const location = useLocation();
    const { dark } = useTheme();

    React.useEffect(() => {
        const fetchJobs = async () => {
            try {
                const token = await getToken();
                const response = await axios.get(
                    `${backendUrl}/api/users/job-search-latest`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    },
                );
                const jobsData = response.data.jobs || [];
                setJobs(mapJobData(jobsData));
            } catch (error) {
                console.error("Error fetching jobs:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchJobs();
    }, []);

    const filteredJobs = React.useMemo(() => {
        return jobs.filter((job: JobData) => {
            return job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                job.company.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [jobs, searchQuery]);

    const sortedJobs = React.useMemo(() => {
        return [...filteredJobs].sort((a, b) => {
            const aValue = a[sortField];
            const bValue = b[sortField];
            const modifier = sortOrder === "asc" ? 1 : -1;

            if (typeof aValue === "string" && typeof bValue === "string") {
                return aValue.localeCompare(bValue) * modifier;
            }
            return (Number(aValue) - Number(bValue)) * modifier;
        });
    }, [filteredJobs, sortField, sortOrder]);

    const totalPages = Math.ceil(sortedJobs.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentJobs = sortedJobs.slice(startIndex, endIndex);

    const getTierColor = (tier: string) => {
        switch (tier.toLowerCase()) {
            case "high match":
                return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
            case "mid match":
                return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
            case "low match":
                return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
            default:
                return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
        }
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("asc");
        }
        setCurrentPage(1);
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) {
            return (
                <div className="flex flex-col ml-2">
                    <ArrowUp className="h-3 w-3 text-gray-400" />
                    <ArrowDown className="h-3 w-3 text-gray-400 -mt-1" />
                </div>
            );
        }
        return sortOrder === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4 text-blue-500" />
        ) : (
            <ArrowDown className="ml-2 h-4 w-4 text-blue-500" />
        );
    };

    const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
        <TableHead 
            className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center justify-between group">
                <span className="font-semibold">{children}</span>
                <SortIcon field={field} />
            </div>
        </TableHead>
    );

    return (
        <div className={dark ? "dark bg-[#111] text-white min-h-screen" : "bg-[#f0f0f0] text-[#333] min-h-screen"}>
            <DashNavBar />
            <motion.div 
                initial={{ opacity: 0, y: 40 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="p-8"
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold">Job Listings</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Showing {currentJobs.length} of {sortedJobs.length} jobs
                            </p>
                        </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search jobs..."
                                    value={searchQuery}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                                    className="pl-10 w-full md:w-64"
                                />
                        </div>
                    </div>

                    <Card className="overflow-hidden">
                        <CardContent className="p-0">
                            {loading ? (
                                <Skeleton count={5} />
                            ) : (
                                <React.Suspense fallback={<Skeleton count={5} />}>
                                    <div className="rounded-md border dark:border-gray-700">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <SortableHeader field="title">Job Title</SortableHeader>
                                                    <SortableHeader field="company">Company</SortableHeader>
                                                    <SortableHeader field="tier">Match Tier</SortableHeader>
                                                    <SortableHeader field="match_score">Match Score</SortableHeader>
                                                    <SortableHeader field="date_posted">Date Posted</SortableHeader>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                <AnimatePresence mode="wait">
                                                    {currentJobs.map((job: JobData) => (
                                                        <motion.tr
                                                            key={job.id}
                                                            initial={{ opacity: 0, y: 20 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -20 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="hover:bg-gray-50 dark:hover:bg-gray-800"
                                                        >
                                                            <TableCell>
                                                                <a 
                                                                    href={job.url} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer" 
                                                                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                                                >
                                                                    {job.title}
                                                                </a>
                                                            </TableCell>
                                                            <TableCell className="font-medium">{job.company}</TableCell>
                                                            <TableCell>
                                                                <Badge className={getTierColor(job.tier)}>
                                                                    {job.tier}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                                        <div 
                                                                            className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                                                                            style={{ width: `${job.match_score}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="font-mono">{job.match_score}%</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-gray-500 dark:text-gray-400">
                                                                {job.date_posted}
                                                            </TableCell>
                                                        </motion.tr>
                                                    ))}
                                                </AnimatePresence>
                                            </TableBody>
                                        </Table>
                                    </div>
                                </React.Suspense>
                            )}
                        </CardContent>
                    </Card>

                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <Button
                                        key={page}
                                        variant={currentPage === page ? "default" : "outline"}
                                        size="icon"
                                        onClick={() => setCurrentPage(page)}
                                        className="w-8 h-8"
                                    >
                                        {page}
                                    </Button>
                                ))}
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {!loading && sortedJobs.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-gray-500 dark:text-gray-400">No jobs found matching your criteria.</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
 