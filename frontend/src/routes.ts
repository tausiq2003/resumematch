/** @jsxImportSource react */
import React from 'react';
import { createBrowserRouter } from "react-router-dom";
import App from "./app";
import Auth from "./components/auth";
import { SignIn, SignUp } from "@clerk/react-router";
import ParentDashboard from "./components/parentdashboard";
import { FormProvider } from "./context/FormContext";
import ParentUserProfileEdit from "./components/parentuserprofileedit";
import JobListings from "./components/JobListings";
import { ErrorPage } from "./components/ErrorBoundary";
import EnhanceResume from "./components/EnhanceResume";
import ProtectedRoute from "./components/ProtectedRoute";

const router = createBrowserRouter([
    {
        path: "/",
        Component: App,
        errorElement: React.createElement(ErrorPage),
    },
    {
        path: "/login/*",
        Component: Auth,
        errorElement: React.createElement(ErrorPage),
        children: [
            {
                path: "verify",
                Component: SignIn,
            },
        ],
    },
    {
        path: "/signin/*",
        Component: Auth,
        errorElement: React.createElement(ErrorPage),
        children: [
            {
                path: "verify",
                Component: SignUp,
            },
        ],
    },
    {
        path: "/dashboard",
        element: React.createElement(ProtectedRoute, null, React.createElement(ParentDashboard)),
        errorElement: React.createElement(ErrorPage),
    },
    {
        path: "/profile",
        element: React.createElement(ProtectedRoute, null, React.createElement(ParentUserProfileEdit)),
        errorElement: React.createElement(ErrorPage),
    },
    {
        path: "/jobs",
        element: React.createElement(ProtectedRoute, null, React.createElement(JobListings)),
        errorElement: React.createElement(ErrorPage),
    },
    {
        path: "/enhance-resume",
        element: React.createElement(ProtectedRoute, null, React.createElement(EnhanceResume)),
        errorElement: React.createElement(ErrorPage),
    },
]);

export default router;
