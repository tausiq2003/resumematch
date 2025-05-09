import { NextFunction, Request, Response } from "express";
import { ApiError } from "./ApiError";

type AsyncRequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction,
) => Promise<any>;

function asyncHandler(fn: AsyncRequestHandler) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await fn(req, res, next);
        } catch (err: any) {
            if (err instanceof ApiError) {
                res.status(err.statusCode).json({
                    success: false,
                    message: err.message,
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: err.message || "Internal Server Error",
                });
            }
        }
    };
}

export { asyncHandler };
