import express from "express";
import { isAuth } from "../middleware/isAuth.js";
import upload from "../middleware/multer.js";
import { createBlog, updateBlog } from "../controller/blog.js";


const router = express.Router();


router.get("/blog", (req, res) => {
    res.send("Blog route works");
});

router.post("/blog/create", isAuth, upload, createBlog);
router.post('/blog/:id', isAuth, upload, updateBlog);



export default router;