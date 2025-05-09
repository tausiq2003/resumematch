import React from 'react';
import JobSearchForm from './JobSearchForm';

interface JobResult {
    id: string;
    title: string;
    company: string;
    location: string;
    description: string;
    // Add other job properties as needed
}

const JobSearch: React.FC = () => {
    const [jobResults, setJobResults] = React.useState<JobResult[]>([]);
    const [loading, setLoading] = React.useState(false);

    const handleSearchResults = (results: JobResult[]) => {
        console.log('Received job results in parent component:', results);
        setJobResults(results);
    };

    return (
        <div className="job-search-container">
            <h1 className="text-2xl font-bold mb-4">Job Search</h1>
            <JobSearchForm onSearchResults={handleSearchResults} />
            
            {loading && <div className="mt-4">Loading...</div>}
            
            {jobResults.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-xl font-semibold mb-4">Search Results</h2>
                    <div className="grid gap-4">
                        {jobResults.map((job: JobResult) => (
                            <div key={job.id} className="border p-4 rounded-lg shadow">
                                <h3 className="text-lg font-medium">{job.title}</h3>
                                <p className="text-gray-600">{job.company}</p>
                                <p className="text-gray-500">{job.location}</p>
                                <p className="mt-2">{job.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default JobSearch; 