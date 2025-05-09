import { User } from "@clerk/express";

declare global {
    namespace Express {
        interface Request {
            user?: User;
            file?: Express.MulterS3.File;
            randomResumeKey?: string;
        }
    }
}

export {};
