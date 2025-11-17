import { configureCloudinary } from "../config/cloudinary.js";
import type { AuthenticationRequest } from "../middleware/isAuth.js";
import getBuffer from "../utils/dataUri.js";
import { sql } from "../utils/db.js";
import TryCatch from "../utils/TryCatch.js";


export const createBlog = TryCatch(async (req: AuthenticationRequest, res) => {
    // Implementation for creating a blog
    const { title, description, blogcontent, category } = req.body;

    const file = req.file;

    if (!file) {
        res.status(400).json({
            message: 'No file uploaded'
        });
        return;
    }

    const fileBuffer = getBuffer(file)

    if (!fileBuffer || !fileBuffer.content) {
        res.status(400).json({
            message: 'Could not process file'
        });
        return;
    }


    // Get the configured cloudinary instance
    const { cloudinary: configuredCloudinary } = configureCloudinary();

    if (!configuredCloudinary.config().api_key) {
        res.status(500).json({
            message: 'Cloudinary is not configured properly'
        });
        return;
    }

    try {
        const cloud = await configuredCloudinary.uploader.upload(fileBuffer.content, {
            folder: 'blogs',
            resource_type: 'auto',
        });

        const result = await sql`
            INSERT INTO blogs (title, description, blogcontent, image, category, author)
            VALUES (${title}, ${description}, ${blogcontent}, ${cloud.secure_url}, ${category}, ${req.user?._id}) RETURNING *;
        `;


        res.status(201).json({ message: "Blog created successfully" , blog: result[0] });
    } catch (error) {
         return res.status(500).json({
            message: 'Error creating blog',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }


});