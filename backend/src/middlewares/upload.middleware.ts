import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

export const verifyDetails = asyncHandler(async (req, _, next) => {
    if (!req.user) {
        throw new ApiError(401, "Unauthorized request");
    }

    const { position, experience_level } = req.body;

    if (!position || typeof position !== "string" || !position.trim()) {
        throw new ApiError(400, "Position field is required");
    }

    const cleanedStr = position.trim();

    const isAlphabetical = /^[A-Za-z\s]+$/.test(cleanedStr);
    if (!isAlphabetical) {
        throw new ApiError(
            400,
            "Position field must contain only letters and spaces",
        );
    }

    // Experience level validation
    const allowedLevels = [
        "no_experience",
        "less_than_3",
        "3_to_5",
        "5_to_10",
        "10_plus",
    ];
    if (
        !experience_level ||
        typeof experience_level !== "string" ||
        !allowedLevels.includes(experience_level)
    ) {
        throw new ApiError(
            400,
            "Experience level is required and must be a valid option",
        );
    }

    if (!req.file) {
        throw new ApiError(400, "Resume file is required");
    }

    next();
});
