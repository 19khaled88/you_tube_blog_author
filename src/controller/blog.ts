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


        res.status(201).json({ message: "Blog created successfully", blog: result[0] });
    } catch (error) {
        return res.status(500).json({
            message: 'Error creating blog',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }


});

export const getBlogs = TryCatch(async (req: AuthenticationRequest, res) => {
    const blogs = await sql`SELECT * FROM blogs ORDER BY created_at DESC;`;
    res.status(200).json({ message: "Blogs fetched successfully", blogs });
});

export const getBlogById = TryCatch(async (req: AuthenticationRequest, res) => {
    const { id } = req.params;
    const blog = await sql`SELECT * FROM blogs WHERE id = ${id};`;
    if (blog.length === 0) {
        return res.status(404).json({ message: "Blog not found" });
    }
    res.status(200).json({ message: "Blog fetched successfully", blog: blog[0] });
});

export const deleteBlog = TryCatch(async (req: AuthenticationRequest, res) => {
    const { id } = req.params;


    const blog = await sql`SELECT FROM blogs WHERE id = ${id} RETURNING *;`;
    if (blog.length === 0) {
        return res.status(404).json({ message: "Blog not found" });
    }

    if (blog[0] && blog[0].author !== req.user?._id) {
        return res.status(403).json({ message: "You are not authorized to update this blog" });
    }

    
    try {
        const deletedBlog = await sql`DELETE FROM blogs WHERE id = ${id} RETURNING *;`;
        const deletedComments = await sql`DELETE FROM comments WHERE blogid = ${id};`;
        const deletedSavedBlogs = await sql`DELETE FROM savedblogs WHERE blogid = ${id};`;

        res.status(200).json({ message: "Blog deleted successfully", blog: blog[0] });
    } catch (error) {
        res.status(400).json({ message: "Blog deleted successfully", blog: blog[0] });
    }

});

export const updateBlog = TryCatch(async (req: AuthenticationRequest, res) => {
    const { id } = req.params;
    const { title, description, blogcontent, category } = req.body;


    const file = req.file;

    // Check if the blog exists and if the user is the author
    const blog = await sql`SELECT * FROM blogs WHERE id = ${id};`;
    if (blog.length === 0) {
        return res.status(404).json({ message: "Blog not found" });
    }

    if (blog[0] && blog[0].author !== req.user?._id) {
        return res.status(403).json({ message: "You are not authorized to update this blog" });
    }


    let imageUrl = blog[0]?.image || '';

    // Handle image upload if a new file is provided and delete existing image
    if (file && imageUrl !== '') {
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
            
            // Delete existing image from Cloudinary if it exists
            if (imageUrl) {
                const existingImagePublicId = extractPublicId(imageUrl);
                if (existingImagePublicId) {
                    await configuredCloudinary.uploader.destroy(existingImagePublicId);
                }
            }
            
            const cloud = await configuredCloudinary.uploader.upload(fileBuffer.content, {
                folder: 'blogs',
                resource_type: 'auto',
            });
            imageUrl = cloud.secure_url;
        } catch (error) {
            return res.status(500).json({
                message: 'Failed to upload image'
            });
        }

    }

    // Dynamic field updates using COALESCE
    try {
        const updatedBlog = await sql`
            UPDATE blogs 
            SET 
                title = COALESCE(${title || null}, title),
                description = COALESCE(${description || null}, description),
                blogcontent = COALESCE(${blogcontent || null}, blogcontent),
                category = COALESCE(${category || null}, category),
                image = COALESCE(${imageUrl || null}, image)
            WHERE id = ${id} 
            RETURNING *
        `;

        return res.status(200).json({ 
            message: "Blog updated successfully", 
            blog: updatedBlog[0] 
        });

    } catch (error) {
        console.error('Database update error:', error);
        return res.status(500).json({ message: "Failed to update blog" });
    }

    

});

function extractPublicId(imageUrl: string): string | null {
    try {
        // Extract public ID from Cloudinary URL
        // Example: https://res.cloudinary.com/demo/image/upload/v1234567/folder/image.jpg
        const matches = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+?)\./);
        return matches && matches[1] ? matches[1] : null;
    } catch {
        return null;
    }
}