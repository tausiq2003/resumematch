// context/FormContext.tsx
import * as React from "react";
import axios from "axios";
import { useAuth, useUser as useClerkUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useUser } from "./UserContext";
import { Loader2 } from "lucide-react";

type FormContextType = {
    showForm: boolean;
    setShowForm: (value: boolean, editMode?: boolean) => void;
    editMode: boolean;
    setEditMode: (value: boolean) => void;
    position: string;
    setPosition: (value: string) => void;
    experience_level: string;
    setExperienceLevel: (value: string) => void;
    resumeFile: File | null;
    setResumeFile: (file: File | null) => void;
    uploadError: string | null;
    setUploadError: (value: string | null) => void;
    isUploading: boolean;
    setIsUploading: (value: boolean) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: (
        e: React.FormEvent | null,
        overridePosition?: string,
        overrideExperienceLevel?: string
    ) => Promise<void>;
};

const FormContext = React.createContext<FormContextType | undefined>(undefined);

export const useFormContext = () => {
    const context = React.useContext(FormContext);
    if (!context) {
        throw new Error("useFormContext must be used within a FormProvider");
    }
    return context;
};

export const FormProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { user: clerkUser } = useClerkUser();
    const [position, setPosition] = useState("");
    const [experience_level, setExperienceLevel] = useState("");
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const { userData } = useUser();
    const { getToken } = useAuth();
    const [showForm, setShowFormRaw] = useState(false);
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    const backendUrl = import.meta.env.VITE_BACKEND_URL!;

    useEffect(() => {
        if (userData) {
            setPosition(userData.position || "");
            setExperienceLevel(userData.experience_level || "");
        }
    }, [userData]);

    const handleSubmit = async (
        e: React.FormEvent | null,
        overridePosition?: string,
        overrideExperienceLevel?: string
    ) => {
        if (e) e.preventDefault();
        setUploadError(null);

        const pos = overridePosition !== undefined ? overridePosition : position;
        const exp = overrideExperienceLevel !== undefined ? overrideExperienceLevel : experience_level;

        if (!pos) {
            setUploadError("Please enter your position.");
            return;
        }
        if (!exp) {
            setUploadError("Please enter your experience level.");
            return;
        }

        setIsUploading(true);

        try {
            const token = await getToken();
            let response;

            if (resumeFile) {
                const formData = new FormData();
                formData.append("resume", resumeFile);
                formData.append("position", pos);
                formData.append("experience_level", exp);

                // Debug: log all FormData entries
                for (let pair of formData.entries()) {
                    console.log("FormData:", pair[0], pair[1]);
                }

                response = await axios.put(
                    `${backendUrl}/api/users/upload-resume`,
                    formData,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "multipart/form-data",
                        },
                        withCredentials: true,
                    },
                );
            } else {
                response = await axios.put(
                    `${backendUrl}/api/users/update-profile`,
                    { position: pos, experience_level: exp },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                        withCredentials: true,
                    },
                );
            }

            if (response.status === 200) {
                setShowForm(false);
                // Refresh the page to update all components
                window.location.reload();
            }
        } catch (error) {
            console.error("Error:", error);
            setUploadError("An error occurred. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUploadError(null);
        const file = e.target.files?.[0];

        if (!file) return;

        if (file.type !== "application/pdf") {
            setUploadError("Only PDF files are allowed.");
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setUploadError("File size must be less than 2MB.");
            return;
        }

        setResumeFile(file);
    };

    const setShowForm = (value: boolean, edit: boolean = false) => {
        setShowFormRaw(value);
        setEditMode(edit);
    };

    // Add a loading component for form submission
    const LoadingOverlay = () => {
        if (!isUploading) return null;
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                    <p className="text-lg text-muted-foreground">
                        Updating your profile...
                    </p>
                </div>
            </div>
        );
    };

    return (
        <FormContext.Provider
            value={{
                showForm,
                setShowForm,
                editMode,
                setEditMode,
                position,
                setPosition,
                experience_level,
                setExperienceLevel,
                resumeFile,
                setResumeFile,
                uploadError,
                setUploadError,
                isUploading,
                setIsUploading,
                fileInputRef,
                handleFileChange,
                handleSubmit,
            }}
        >
            {children}
            <LoadingOverlay />
        </FormContext.Provider>
    );
};
