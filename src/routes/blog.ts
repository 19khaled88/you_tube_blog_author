import express from "express";
import { isAuth } from "../middleware/isAuth.js";
import upload from "../middleware/multer.js";
import {
  createBlog,
  deleteBlog,
  getBlogs,
  updateBlog,
  GeminiAiTitleResponse,
  GeminiAiDescriptionResponse,
} from "../controller/blog.js";

const router = express.Router();

router.get("/blog", (req, res) => {
  res.send("Blog route works");
});

router.get("/blogs", isAuth, getBlogs);
router.post("/blog/create", isAuth, upload.single("file"), createBlog);
router.patch("/blog/:id", isAuth, upload.single("file"), updateBlog);
router.delete("/blog/:id", isAuth, deleteBlog);
router.post("/geminiResponse/title", GeminiAiTitleResponse);
router.post("/geminiResponse/description", GeminiAiDescriptionResponse);

export default router;
