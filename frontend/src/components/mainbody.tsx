import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, FileText, Search, Shield } from "lucide-react";

export default function Main() {
    const navigate = useNavigate();

    const features = [
        {
            icon: <FileText className="w-6 h-6" />,
            title: "ATS-Optimized Resumes",
            description: "Get your resume optimized for Applicant Tracking Systems with AI-powered analysis."
        },
        {
            icon: <Search className="w-6 h-6" />,
            title: "Smart Job Matching",
            description: "Find the perfect job matches based on your skills and experience."
        },
        {
            icon: <Shield className="w-6 h-6" />,
            title: "Secure & Private",
            description: "Your data is protected with enterprise-grade security measures."
        }
    ];

    const steps = [
        {
            icon: <FileText className="w-8 h-8" />,
            title: "Upload Your Resume",
            description: "Upload your resume in PDF format in secured way."
        },
        {
            icon: <Search className="w-8 h-8" />,
            title: "AI Analysis",
            description: "Our AI analyzes your resume and provides detailed insights."
        },
        {
            icon: <CheckCircle2 className="w-8 h-8" />,
            title: "Get Results",
            description: "Receive your optimized resume and job matches instantly."
        }
    ];

    const date = new Date();
    const year = date.getFullYear();

    return (
        <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
            {/* Hero Section */}
            <section id="home" className="relative h-screen flex items-center justify-center">
                <div className="absolute inset-0 bg-white" />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center">
                        <motion.h1 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                            className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6"
                        >
                            Land Your Dream Job with
                            <span className="text-blue-600"> AI-Powered</span> Resume Analysis
                        </motion.h1>
                        <motion.p 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="text-xl text-gray-600 max-w-3xl mx-auto mb-8"
                        >
                            Get your resume optimized for ATS systems, receive personalized job matches, and increase your chances of landing interviews.
                        </motion.p>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.4 }}
                        >
                            <button
                                onClick={() => navigate('/login')}
                                className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                            >
                                Get Started
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </button>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
                        <p className="text-xl text-gray-600">Simple steps to optimize your resume and find your dream job</p>
                    </motion.div>
                    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                        {steps.map((step, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: index * 0.2 }}
                                viewport={{ once: true }}
                                className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300"
                            >
                                <div className="flex items-center mb-4">
                                    <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                                        {step.icon}
                                    </div>
                                    <h3 className="ml-4 text-xl font-semibold text-gray-900">
                                        {step.title}
                                    </h3>
                                </div>
                                <p className="text-gray-600">
                                    {step.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Us</h2>
                        <p className="text-xl text-gray-600">Experience the difference with our advanced features</p>
                    </motion.div>
                    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                        {features.map((feature, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: index * 0.2 }}
                                viewport={{ once: true }}
                                className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300"
                            >
                                <div className="flex items-center mb-4">
                                    <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                                        {feature.icon}
                                    </div>
                                    <h3 className="ml-4 text-xl font-semibold text-gray-900">
                                        {feature.title}
                                    </h3>
                                </div>
                                <p className="text-gray-600">
                                    {feature.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* About Us Section */}
            <section id="about" className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">About Our Project</h2>
                        <p className="text-xl text-gray-600">Revolutionizing Resume Analysis with AI</p>
                    </motion.div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8 }}
                            viewport={{ once: true }}
                        >
                            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Project Overview</h3>
                            <p className="text-gray-600 mb-6">
                                ResumeMatch is our final year project that aims to bridge the gap between job seekers and opportunities 
                                using cutting-edge AI technology. We've combined advanced natural language processing with machine learning 
                                to create a system that not only analyzes resumes but also provides actionable insights for improvement.
                            </p>
                            <p className="text-gray-600">
                                Our project focuses on three key areas: ATS optimization, skill analysis, and personalized job matching, 
                                making it easier for candidates to stand out in today's competitive job market.
                            </p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8 }}
                            viewport={{ once: true }}
                            className="bg-gray-100 p-8 rounded-xl"
                        >
                            <div className="grid grid-cols-2 gap-4">
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-blue-600 mb-2">AI</div>
                                    <div className="text-gray-600">Powered Analysis</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-blue-600 mb-2">100%</div>
                                    <div className="text-gray-600">Privacy Focused</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-blue-600 mb-2">24/7</div>
                                    <div className="text-gray-600">Availability</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-blue-600 mb-2">3</div>
                                    <div className="text-gray-600">Core Features</div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Footer Section */}
            <footer className="bg-gray-900 text-white py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                            viewport={{ once: true }}
                            className="text-center"
                        >
                            <h3 className="text-2xl font-bold mb-2">ResumeMatch</h3>
                            <p className="text-gray-400">Your AI-Powered Career Companion</p>
                        </motion.div>
                        
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            viewport={{ once: true }}
                            className="flex items-center space-x-2 text-gray-400"
                        >
                            <span>Made with</span>
                            <motion.span
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                                className="text-red-500"
                            >
                                ❤️
                            </motion.span>
                            <span>by</span>
                        </motion.div>
                        
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.4 }}
                            viewport={{ once: true }}
                            className="flex flex-col items-center space-y-1"
                        >
                            <p className="text-gray-400">Tausiq Samantaray</p>
                            <p className="text-gray-400">&</p>
                            <p className="text-gray-400">Yogajeevan Mohanty</p>
                        </motion.div>
                        
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.6 }}
                            viewport={{ once: true }}
                            className="text-sm text-gray-500 mt-4"
                        >
                            Final Year Project © {year}
                        </motion.div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
