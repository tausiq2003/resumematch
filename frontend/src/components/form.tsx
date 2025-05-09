import { useFormContext } from "../context/FormContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useTheme } from "../context/ThemeContext";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";

const allowedLevels = [
    "no_experience",
    "less_than_3",
    "3_to_5",
    "5_to_10",
    "10_plus",
];

export default function Form({
    onClose,
}: {
    onClose: () => void;
}) {
    const {
        position,
        setPosition,
        experience_level,
        setExperienceLevel,
        resumeFile,
        setResumeFile,
        uploadError,
        setUploadError,
        isUploading,
        fileInputRef,
        handleFileChange,
        handleSubmit: contextHandleSubmit,
    } = useFormContext();
    const { dark } = useTheme();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        defaultValues: {
            position: position,
            experience_level: experience_level,
        },
    });

    const onSubmit = (data: any) => {
        setUploadError(null);
        contextHandleSubmit(null, data.position, data.experience_level);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-1000">
            <div className={`bg-white dark:bg-[#333] p-6 rounded-lg shadow-lg w-full max-w-md relative ${dark ? "text-white" : ""}`}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                    <X className="h-6 w-6" />
                </button>
                <h2 className="text-2xl font-bold mb-6">Update Profile</h2>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <label
                                htmlFor="position"
                                className="text-sm font-medium"
                            >
                                Position
                            </label>
                            <Input
                                id="position"
                            {...register("position", {
                                required: "Position is required",
                                pattern: {
                                    value: /^[A-Za-z\s]+$/,
                                    message: "Only letters and spaces allowed",
                                },
                            })}
                            className={dark ? "bg-[#444] text-white border-gray-600" : ""}
                        />
                        {errors.position && (
                            <p className="text-red-500 text-sm">{errors.position.message as string}</p>
                        )}
                        </div>
                        <div>
                            <label
                                htmlFor="experience_level"
                                className="text-sm font-medium"
                            >
                                Experience Level
                            </label>
                            <select
                                id="experience_level"
                            {...register("experience_level", {
                                required: "Experience level is required",
                                validate: (val) => allowedLevels.includes(val) || "Invalid experience level",
                            })}
                            className={`w-full rounded-md border px-3 py-2 text-sm ${dark ? "bg-[#444] text-white border-gray-600" : "bg-white text-black border-gray-300"}`}
                            >
                                <option value="">Select experience level</option>
                                <option value="no_experience">No Experience</option>
                                <option value="less_than_3">Less than 3 years</option>
                                <option value="3_to_5">3 to 5 years</option>
                                <option value="5_to_10">5 to 10 years</option>
                                <option value="10_plus">10+ years</option>
                            </select>
                        {errors.experience_level && (
                            <p className="text-red-500 text-sm">{errors.experience_level.message as string}</p>
                        )}
                        </div>
                        <div>
                            <label
                                htmlFor="resume"
                                className="text-sm font-medium"
                            >
                            Resume (PDF only, max 2MB)
                            </label>
                                <input
                                    type="file"
                                    id="resume"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".pdf"
                            className="w-full mt-1"
                        />
                            {resumeFile && (
                            <p className="text-sm text-green-600 mt-1">
                                Selected: {resumeFile.name}
                                </p>
                            )}
                        </div>
                    {uploadError && (
                        <p className="text-red-500 text-sm">{uploadError}</p>
                    )}
                            <Button
                                type="submit"
                        className="w-full"
                                disabled={isUploading}
                    >
                        {isUploading ? "Updating..." : "Update Profile"}
                            </Button>
                </form>
            </div>
        </div>
    );
}
