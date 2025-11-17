import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();
// const db = neon(process.env.DB_URL);

// export default db;


export const sql = neon(process.env.DB_URL as string);