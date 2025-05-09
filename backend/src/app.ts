import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./routes/users.routes.ts";
import { config } from "dotenv";
import { clerkMiddleware } from "@clerk/express";
const app = express();
config({ path: ".env" });

console.log(process.env.CORS_ORIGIN);

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());
app.use(clerkMiddleware());

app.use("/api/users", userRouter);

app.get("/", (req, res) => {
    res.status(200).json({ message: "API is running" });
});

export { app };
