import { Router } from "express";
import {
    registerUser,
    upload,
    uploadFiles,
    getLatestJobSearchResult,
    updateProfile,
} from "../controllers/user.controller.ts";
import { verifyAuth } from "../middlewares/auth.middleware.ts";
import { verifyDetails } from "../middlewares/upload.middleware.ts";
import {
    fetchJobs,
    analyzeResume,
    enhanceResume,
} from "../controllers/jobs.controller";

const router = Router();

router.route("/check").get(verifyAuth, registerUser);
router
    .route("/upload-resume")
    .put(verifyAuth, upload.single("resume"), verifyDetails, uploadFiles);

router.route("/update-profile").put(verifyAuth, updateProfile);

router.route("/job-search-latest").get(verifyAuth, getLatestJobSearchResult);
router.route("/fetch-jobs").post(verifyAuth, fetchJobs);
router.route("/analyze-resume").post(verifyAuth, analyzeResume);
router.route("/enhance-resume").post(verifyAuth, enhanceResume);

export default router;
