import { configureCloudinary } from "../config/cloudinary.js";
import type { AuthenticationRequest } from "../middleware/isAuth.js";
import getBuffer from "../utils/dataUri.js";
import { sql } from "../utils/db.js";
import { compressImage } from "../utils/imageCompressor.js";
import { invalidateChacheJob } from "../utils/rabbitmq.js";
import TryCatch from "../utils/TryCatch.js";

import { GoogleGenAI } from "@google/genai";

export const createBlog = TryCatch(async (req: AuthenticationRequest, res) => {
  // Implementation for creating a blog
  const { title, description, blogcontent, category } = req.body;

  const file = req.file;

  if (!file) {
    res.status(400).json({
      message: "No file uploaded",
    });
    return;
  }

  const fileBuffer = getBuffer(file);

  if (!fileBuffer || !fileBuffer.content) {
    res.status(400).json({
      message: "Could not process file",
    });
    return;
  }

  // Get the configured cloudinary instance
  const { cloudinary: configuredCloudinary } = configureCloudinary();

  if (!configuredCloudinary.config().api_key) {
    res.status(500).json({
      message: "Cloudinary is not configured properly",
    });
    return;
  }

  try {
    // const cloud = await configuredCloudinary.uploader.upload(fileBuffer.content, {
    //     folder: 'blogs',
    //     resource_type: 'auto',
    // });

    // 1. Compress the image directly from file buffer
    const compressedBuffer = await compressImage(file.buffer, 1); // Compress to max 1MB

    // Now use compressedBuffer for Cloudinary upload
    const base64Image = compressedBuffer.toString("base64");
    const dataUri = `data:${file.mimetype};base64,${base64Image}`;

    // 2. Upload the COMPRESSED buffer to Cloudinary (no need for DataURI)
    const cloud = await configuredCloudinary.uploader.upload(dataUri, {
      folder: "blogs",
      resource_type: "image",
    });
    const result = await sql`
            INSERT INTO blogs (title, description, blogcontent, image, category, author)
            VALUES (${title}, ${description}, ${blogcontent}, ${cloud.secure_url}, ${category}, ${req.user?._id}) RETURNING *;
        `;

    await invalidateChacheJob(["blogs:*"]);

    res
      .status(201)
      .json({ message: "Blog created successfully", blog: result[0] });
  } catch (error) {
    return res.status(500).json({
      message: "Error creating blog",
      error: error instanceof Error ? error.message : "Unknown error",
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

  const blog = await sql`SELECT * FROM blogs WHERE id = ${id};`;
  if (blog.length === 0) {
    return res.status(404).json({ message: "Blog not found" });
  }

  if (blog[0] && blog[0].author !== req.user?._id) {
    return res
      .status(403)
      .json({ message: "You are not authorized to update this blog" });
  }

  try {
    const deletedBlog =
      await sql`DELETE FROM blogs WHERE id = ${id} RETURNING *;`;
    const deletedComments =
      await sql`DELETE FROM comments WHERE blogid = ${id};`;
    const deletedSavedBlogs =
      await sql`DELETE FROM savedblogs WHERE blogid = ${id};`;

    await invalidateChacheJob(["blogs:*", `blog:${id}`]);

    res
      .status(200)
      .json({ message: "Blog deleted successfully", blog: blog[0] });
  } catch (error) {
    res
      .status(400)
      .json({ message: "Blog deleted successfully", blog: blog[0] });
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
    return res
      .status(403)
      .json({ message: "You are not authorized to update this blog" });
  }

  let imageUrl = blog[0]?.image || "";

  // Handle image upload if a new file is provided and delete existing image
  if (file && imageUrl !== "") {
    const fileBuffer = getBuffer(file);
    if (!fileBuffer || !fileBuffer.content) {
      res.status(400).json({
        message: "Could not process file",
      });
      return;
    }

    // Get the configured cloudinary instance
    const { cloudinary: configuredCloudinary } = configureCloudinary();

    if (!configuredCloudinary.config().api_key) {
      res.status(500).json({
        message: "Cloudinary is not configured properly",
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

      const cloud = await configuredCloudinary.uploader.upload(
        fileBuffer.content,
        {
          folder: "blogs",
          resource_type: "auto",
        }
      );
      imageUrl = cloud.secure_url;
    } catch (error) {
      return res.status(500).json({
        message: "Failed to upload image",
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

    await invalidateChacheJob(["blogs:*", `blog:${id}`]);

    return res.status(200).json({
      message: "Blog updated successfully",
      blog: updatedBlog[0],
    });
  } catch (error) {
    console.error("Database update error:", error);
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

export const GeminiAiTitleResponse = TryCatch(async (req, res) => {
  const { text } = req.body;

  // const prompt = `Generate a detailed blog post on the following topic:\n\n${text}\n\nThe blog post should be well-structured, informative, and engaging. Include an introduction, main content with subheadings, and a conclusion. Use a friendly and professional tone.`;
  const prompt = `Correct the grammar of the following blog title and return only the corrected title without any additional text, formatting, or symbols: "${text}"`;

  let result;

  const genai = new GoogleGenAI({ apiKey: process.env.Gemini_API_Key! });

  async function main() {
    const response = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    let rawText = response.text;

    if (!rawText) {
      return res.status(500).json({ message: "Failed to generate content" });
    }

    result = rawText
      .replace(/\*\*/g, "")
      .replace(/[\r\n]+/g, " ")
      .replace(/[*_`~]/g, "")
      .trim();
  }

  await main();

  return res.status(200).json({ message: "Content generated", result });
});

export const GeminiAiDescriptionResponse = TryCatch(async (req, res) => {
  const { title, description } = req.body;

  // const prompt = `Generate a detailed blog post on the following topic:\n\n${text}\n\nThe blog post should be well-structured, informative, and engaging. Include an introduction, main content with subheadings, and a conclusion. Use a friendly and professional tone.`;
  const prompt =
    description === ""
      ? `Generate only one short blog descpription based on this title:"${title}".
       Your response must be only one sentence, strictly under 30 words, with no 
       options, no greetings, and no extra text. Do not explain. Do not say 'here is'. 
       Just return the description only.`
      : `Fix the grammar in the following blog description and return only the corrected sentence. Do not add anything else: "${description}"`;

  let result;

  const genai = new GoogleGenAI({ apiKey: process.env.Gemini_API_Key! });

  async function main() {
    const response = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    let rawText = response.text;

    if (!rawText) {
      return res.status(500).json({ message: "Failed to generate content" });
    }

    result = rawText
      .replace(/\*\*/g, "")
      .replace(/[\r\n]+/g, " ")
      .replace(/[*_`~]/g, "")
      .trim();
  }

  await main();

  return res.status(200).json({ message: "Content generated", result });
});


export const GeminiAiBlogResponse = TryCatch(async (req, res) => {
  const { blog } = req.body;

  if (!blog) return res.status(400).json({ message: "No blog provided" });

  const prompt = `
      You are a grammar correction engine.
      Rules:
      - Keep all HTML as-is
      - Fix only grammar, spelling, punctuation
      - Do not add or remove content
      - Output HTML only
    `;

  const fullMessage = `${prompt}\n\n${blog}`;

  const ai = new GoogleGenAI({ apiKey: process.env.Gemini_API_Key! });

  // Use a valid model from the NEW SDK
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash", // ✅ Free and works
    contents: fullMessage,
  });

  const output = response.text;

  if (!output) {
    return res.status(500).json({
      message: "Empty response from AI",
    });
  }

  return res.status(200).json({
    message: "Content generated",
    result: output.trim(),
  });
});
