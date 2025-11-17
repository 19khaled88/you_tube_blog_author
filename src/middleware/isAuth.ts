import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from 'jsonwebtoken';


interface IUser extends Document{
    _id: string;
    name: string;
    email: string;
    image: string;
    instrgram: string; // Note: typo - should be "instagram"
    facebook: string;
    linkedin: string;
    bio: string;
}


export interface AuthenticationRequest extends Request{
    user?:IUser | null
}
export const isAuth =async(req:AuthenticationRequest,res:Response,next:NextFunction):Promise<void>=>{
    try {
        const authHeader = req.headers.authorization;

        if(!authHeader || !authHeader.startsWith('Bearer ')){
            res.status(401).json({
                message:"No auth header found"
            });
            return;
        }

        const token = authHeader.split(" ")[1]

        if(!token){
            res.status(401).json({
                message:'Invalid token format'
            });
            return;
        }
        const decoded = jwt.verify(token, process.env.JWT_SEC as string) as JwtPayload

        if(!decoded || !decoded.user){
            res.status(401).json({
                message:'Invalid token'
            });
            return;
        }

        req.user = decoded.user
        next();
    } catch (error) {
        res.status(401).json({
            message:'Token not found'
        })
    }
}