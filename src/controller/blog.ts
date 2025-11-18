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
    const blog = await sql`DELETE FROM blogs WHERE id = ${id} RETURNING *;`;
    if (blog.length === 0) {
        return res.status(404).json({ message: "Blog not found" });
    }
    res.status(200).json({ message: "Blog deleted successfully", blog: blog[0] });
});

export const updateBlog = TryCatch(async (req: AuthenticationRequest, res) => {
    const { id } = req.params;
    const { title, description, blogcontent, category } = req.body;


    const file = req.file;

    const blog = await sql`SELECT * FROM blogs WHERE id = ${id};`;
    if (blog.length === 0) {
        return res.status(404).json({ message: "Blog not found" });
    }

    if (blog[0] && blog[0].author !== req.user?._id) {
        return res.status(403).json({ message: "You are not authorized to update this blog" });
    }


    let imageUrl = blog[0]?.image || '';
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

        const cloud = await configuredCloudinary.uploader.upload(fileBuffer.content, {
            folder: 'blogs',
            resource_type: 'auto',
        });
        imageUrl = cloud.secure_url;
    }

    const updatedBlog = await sql`
        UPDATE blogs 
        SET title = ${title}, description = ${description}, blogcontent = ${blogcontent}, category = ${category}, image = ${imageUrl}    
        WHERE id = ${id} RETURNING *;
    `;  
    res.status(200).json({ message: "Blog updated successfully", blog: updatedBlog[0] });


    res.json({ message: "Blog updated successfully", blog: updatedBlog[0] });


});