import type { NextFunction, Request, RequestHandler, Response } from "express";


const TryCatch = (handler:RequestHandler):RequestHandler=>{
    return async(req:Request,res:Response,next:NextFunction):Promise<void>=>{
        try {
            await handler(req,res,next)
        } catch (error:any) {
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal Server Error';

            res.status(statusCode).json({
                message,
                ...(process.env.NODE_ENV === 'development' && {stack:error.stack})
            })
        }
    }
}

export default TryCatch