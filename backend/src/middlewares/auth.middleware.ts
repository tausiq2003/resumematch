import { verifyToken } from "@clerk/backend";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { clerkClient } from "@clerk/express";

export const verifyAuth = asyncHandler(async (req, _, next) => {
    try {
        const token = req.header("Authorization")?.replace("Bearer ", "");
        if (!token) {
            throw new ApiError(401, "Unauthorized request");
        }
        const auth = await verifyToken(token, {
            jwtKey: process.env.CLERK_JWT_KEY,
        });
        const userId = auth?.sub || null;
        if (!userId) {
            throw new ApiError(401, "Invalid token, user not found");
        }
        const user = await clerkClient.users.getUser(userId);
        if (!user) {
            throw new ApiError(401, "Invalid token");
        }
        req.user = user;
        next();
    } catch (err: any) {
        throw new ApiError(401, err?.message || "Invalid token");
    }
});
