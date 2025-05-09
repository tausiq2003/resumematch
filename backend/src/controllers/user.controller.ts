import { asyncHandler } from "../utils/asyncHandler";
import { db } from "../db";
import { ApiError } from "../utils/ApiError";
import { users } from "../models/users.models";
import { eq } from "drizzle-orm";
import { ApiResponse } from "../utils/ApiResponse";
import {
    DeleteObjectCommand,
    S3Client,
    ListObjectsV2Command,
    DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import multer from "multer";
import multerS3 from "multer-s3";
import path, { basename } from "path";
import { clerkClient } from "@clerk/express";
import axios from "axios";
import { jobSearchResults } from "../models/users.models";
import crypto from "crypto";

const getCloudFrontUrl = (key: string) => {
    const cloudfrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
    if (!cloudfrontDomain) throw new ApiError(500, "CloudFront domain not set");
    return `https://${cloudfrontDomain}/${key}`;
};

export const registerUser = asyncHandler(async (req, res) => {
    try {
        const clerkId = req.user?.id;
        const email = req.user?.primaryEmailAddress?.emailAddress;
        const username = req.user?.username;
        const createdAt = req.user?.createdAt;
        const updateAt = req.user?.updatedAt;

        // console.log("User data from clerk:", { clerkId, email, username });

        if (!clerkId || !email || !username) {
            throw new ApiError(400, "Required user information missing");
        }

        const data = await db
            .select()
            .from(users)
            .where(eq(users.clerkId, clerkId));

        // console.log("Database query result:", data);
        if (data.length > 0) {
            const {
                id: existingId,
                clerkId: existingclerkId,
                createdAt: existingCreatedAt,
                updatedAt: existingUpdatedAt,
                ...safeObj
            } = data[0];
            if (!safeObj) {
                throw new ApiError(500, "Internal Error");
            }
            //add here public metadata, cuz its here
            await clerkClient.users.updateUserMetadata(clerkId, {
                publicMetadata: {
                    position: safeObj.position,
                    experience_level: safeObj.experience_level,
                    resumeLink: safeObj.resumeLink,
                },
            });
            console.log("fucked data: ", {
                position: safeObj.position,
                experience_level: safeObj.experience_level,
                resumeLink: safeObj.resumeLink,
            });
            // Return CloudFront URL for resumeLink if present
            const responseObj = {
                ...safeObj,
                resumeLink: safeObj.resumeLink
                    ? getCloudFrontUrl(safeObj.resumeLink)
                    : null,
            };
            return res
                .status(200)
                .json(new ApiResponse(200, responseObj, "user found"));
        }

        const [newUser] = await db
            .insert(users)
            .values({
                clerkId: clerkId,
                email: email,
                username: username,
                resumeLink: null,
                position: null,
                experience_level: null,
                createdAt: new Date(createdAt || Date.now()),
                updatedAt: new Date(updateAt || Date.now()),
            })
            .returning();

        // console.log("New user created:", newUser);
        const {
            id: newId,
            clerkId: newClerkId,
            createdAt: newCreatedAt,
            updatedAt: newUpdatedAt,
            ...safeObj
        } = newUser;

        if (!safeObj) {
            throw new ApiError(500, "Internal Error");
        }
        //update public metadata clerk yeah just same code ig
        await clerkClient.users.updateUserMetadata(clerkId, {
            publicMetadata: {
                position: safeObj.position,
                experience_level: safeObj.experience_level,
                resumeLink: safeObj.resumeLink,
            },
        });
        const responseObj = {
            ...safeObj,
            resumeLink: safeObj.resumeLink
                ? getCloudFrontUrl(safeObj.resumeLink)
                : null,
        };
        return res
            .status(200)
            .json(new ApiResponse(200, responseObj, "New user registered"));
    } catch (err) {
        // console.error("Error in getUser:", err);
        throw new ApiError(
            500,
            err instanceof Error ? err.message : "Internal server error",
        );
    }
});

const configS3 = () => {
    const {
        AWS_REGION,
        AWS_ACCESS_KEY,
        AWS_SECRET_ACCESS_KEY,
        AWS_BUCKET_NAME,
    } = process.env;

    if (
        !AWS_REGION ||
        !AWS_ACCESS_KEY ||
        !AWS_SECRET_ACCESS_KEY ||
        !AWS_BUCKET_NAME
    ) {
        throw new ApiError(
            500,
            "Missing AWS credentials or region in environment variables",
        );
    }

    return new S3Client({
        region: AWS_REGION,
        credentials: {
            accessKeyId: AWS_ACCESS_KEY,
            secretAccessKey: AWS_SECRET_ACCESS_KEY,
        },
    });
};

//upload file, there should be update in future, to handle that, it can be handled in frontend

const s3PushClient = configS3();

export const upload = multer({
    storage: multerS3({
        s3: s3PushClient,
        bucket: `${process.env.AWS_BUCKET_NAME}`,
        acl: "private",
        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.filename });
        },
        key: function (req, file, cb) {
            // Use original filename and Date.now()
            const originalName = path
                .parse(file.originalname)
                .name.replace(/[^a-zA-Z0-9_-]/g, "_");
            const ext = path.extname(file.originalname) || ".pdf";
            const timestamp = Date.now();
            const s3Key = `user/uploads/${originalName}-${timestamp}${ext}`;
            req.randomResumeKey = s3Key;
            cb(null, s3Key);
        },
    }),
    limits: {
        fileSize: 1024 * 1024 * 2,
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new ApiError(400, "Only pdf files are allowed"));
        }
    },
});

export const uploadFiles = asyncHandler(async (req, res) => {
    try {
        const file = req.file as Express.MulterS3.File;
        if (!file) {
            throw new ApiError(400, "No file uploaded");
        }
        if (!req.user) {
            throw new ApiError(401, "Unauthorized");
        }

        // Debug: log what multer parsed from the form
        console.log("[uploadFiles] req.body.position:", req.body.position);
        console.log(
            "[uploadFiles] req.body.experience_level:",
            req.body.experience_level,
        );

        // Get old resume from DB
        const [userRow] = await db
            .select()
            .from(users)
            .where(eq(users.clerkId, req.user.id));
        const oldResumeKey = userRow?.resumeLink;

        // Delete old resume from S3 if exists
        if (oldResumeKey) {
            const s3 = configS3();
            const bucket = process.env.AWS_BUCKET_NAME;
            if (bucket) {
                try {
                    await s3.send(
                        new DeleteObjectCommand({
                            Bucket: bucket,
                            Key: oldResumeKey,
                        }),
                    );
                } catch (err) {
                    console.warn("Failed to delete old resume from S3:", err);
                }
            }
        }

        // Use the same S3 key generated in multerS3 for DB
        const s3Key = req.randomResumeKey;
        const position = req.body.position;
        const experience_level = req.body.experience_level;

        // Update DB with new resumeLink
        const [updated] = await db
            .update(users)
            .set({
                resumeLink: s3Key,
                position: position || userRow?.position,
                experience_level: experience_level || userRow?.experience_level,
            })
            .where(eq(users.clerkId, req.user.id))
            .returning();

        // Update Clerk metadata
        await clerkClient.users.updateUser(req.user.id, {
            publicMetadata: {
                position: position || userRow?.position,
                experience_level: experience_level || userRow?.experience_level,
                resumeLink: s3Key,
            },
        });

        const responseObj = {
            ...updated,
            resumeLink: s3Key ? getCloudFrontUrl(s3Key) : null,
        };
        res.status(200).json(
            new ApiResponse(200, responseObj, "Resume uploaded successfully"),
        );
    } catch (err) {
        console.log(err);
        throw new ApiError(500, "File uploading failed");
    }
});

export const getLatestJobSearchResult = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new ApiError(401, "Unauthorized: Missing user ID");
    }
    const [result] = await db
        .select()
        .from(jobSearchResults)
        .where(eq(jobSearchResults.userId, userId))
        .orderBy(jobSearchResults.updatedAt)
        .limit(1);
    if (!result) {
        return res
            .status(200)
            .json({ jobs: [], lockedUntil: null, isLocked: false });
    }
    let jobs: any[] = [];
    const searchData: any = result.searchData;
    if (searchData && typeof searchData === "object") {
        if (Array.isArray(searchData.jobs)) {
            jobs = searchData.jobs;
        } else if (
            searchData.data &&
            typeof searchData.data === "object" &&
            Array.isArray(searchData.data.jobs)
        ) {
            jobs = searchData.data.jobs;
        }
    }
    return res.status(200).json({
        jobs,
        lockedUntil: result.lockedUntil,
        isLocked: result.isLocked,
        searchData: result.searchData,
    });
});

export const updateProfile = asyncHandler(async (req, res) => {
    const clerkId = req.user?.id;
    if (!clerkId) {
        throw new ApiError(401, "Unauthorized");
    }

    const { position, experience_level } = req.body;

    // Validation (same as verifyDetails)
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

    try {
        // Update in Supabase
        const [updated] = await db
            .update(users)
            .set({
                position: position,
                experience_level: experience_level,
                updatedAt: new Date(),
            })
            .where(eq(users.clerkId, clerkId))
            .returning();

        if (!updated) {
            throw new ApiError(404, "User not found");
        }

        // Update in Clerk
        await clerkClient.users.updateUser(clerkId, {
            publicMetadata: {
                position: position,
                experience_level: experience_level,
                resumeLink: updated.resumeLink,
            },
        });

        // Return updated user with CloudFront URL
        const responseObj = {
            ...updated,
            resumeLink: updated.resumeLink
                ? getCloudFrontUrl(updated.resumeLink)
                : null,
        };

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    responseObj,
                    "Profile updated successfully",
                ),
            );
    } catch (err) {
        console.error("Error updating profile:", err);
        throw new ApiError(500, "Failed to update profile");
    }
});

// Helper to delete all S3 files for a user
async function deleteAllUserFilesFromS3(username: string) {
    const s3 = configS3();
    const bucket = process.env.AWS_BUCKET_NAME;
    if (!bucket) throw new ApiError(500, "Missing AWS_BUCKET_NAME");
    const prefix = `user/uploads/`;
    // List all objects under the user's folder
    const listParams = {
        Bucket: bucket,
        Prefix: prefix,
    };
    const listedObjects = await s3.send(new ListObjectsV2Command(listParams));
    if (!listedObjects.Contents || listedObjects.Contents.length === 0) return;
    // Delete all objects
    const deleteParams = {
        Bucket: bucket,
        Delete: {
            Objects: listedObjects.Contents.map((obj) => ({ Key: obj.Key })),
        },
    };
    await s3.send(new DeleteObjectsCommand(deleteParams));
}

// Clerk webhook for user.deleted
export const handleClerkUserDeleted = asyncHandler(async (req, res) => {
    const { id: clerkId } = req.body.data;
    if (!clerkId)
        return res.status(400).json({ error: "Missing Clerk user id" });
    // Get username from Supabase
    const [userRow] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, clerkId));
    if (userRow && userRow.username) {
        await deleteAllUserFilesFromS3(userRow.username);
    }
    // Delete from Supabase
    await db.delete(users).where(eq(users.clerkId, clerkId));
    // Optionally: Delete from Clerk (if not already deleted)
    // await clerkClient.users.deleteUser(clerkId);
    return res
        .status(200)
        .json({ message: "User deleted from Supabase and S3" });
});

export const deleteAccount = asyncHandler(async (req, res) => {
    const clerkId = req.user?.id;
    if (!clerkId) {
        throw new ApiError(401, "Unauthorized");
    }

    try {
        // Get user data from Supabase
        const [userRow] = await db
            .select()
            .from(users)
            .where(eq(users.clerkId, clerkId));
        if (!userRow) {
            throw new ApiError(404, "User not found");
        }

        // Delete files from S3
        if (userRow.username) {
            await deleteAllUserFilesFromS3(userRow.username);
        }

        // Delete from Supabase
        await db.delete(users).where(eq(users.clerkId, clerkId));

        // Delete from Clerk
        await clerkClient.users.deleteUser(clerkId);

        return res
            .status(200)
            .json(new ApiResponse(200, null, "Account deleted successfully"));
    } catch (err) {
        console.error("Error deleting account:", err);
        throw new ApiError(500, "Failed to delete account");
    }
});
