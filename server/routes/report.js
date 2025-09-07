import express from "express";
import multer from "multer";
import { protect, authorize } from "../middlewares/auth.js";
import {
  getAllReport,
  getUserReport,
  trendingReport,
  getReportStat,
  getSingleReport,
  createReport,
  updateReport,
  deleteReport,
  postComment,
  reportStats,
  deleteReportImage,
  statsTrend,
} from "../controllers/reportController.js";
// import { upload } from '../utils/multer.js'; // <-- disk storage multer
// import { upload } from '../utils/multer.js'; // <-- disk storage multer
import path from "path";

const storage = multer.diskStorage({});
const upload = multer({ storage });

// Enhanced report route to handle image uploads

const router = express.Router();

// Get all reports (for admin with filtering)
router.get(
  "/",
  protect,
  authorize("admin", "security", "medical", "special"),
  getAllReport
);

// Get user's reports
router.get("/my-reports", protect, getUserReport);

// Get report statistics
router.get("/stats", protect, getReportStat);

// create/update with disk storage -> cloudinary in controller
router.post("/", protect, createReport);
router.put("/:id", protect, updateReport);

// Delete report image
router.delete("/:reportId/image", protect, deleteReportImage);

// Get single report
router.get("/:id", protect, getSingleReport);

// Create new report with file upload
// router.post('/', protect, upload.array('images', 5), createReport);

// Update report with file upload
// router.put('/:id', protect, upload.array('images', 5), updateReport);

// Delete report
router.delete("/:id", protect, deleteReport);

// Add comment to report
router.post("/:id/comments", protect, postComment);

// Additional endpoint for trend data
router.get("/stats/trend", protect, authorize("admin", "security"), statsTrend);

// Get trending incidents
router.get("/trending/incidents", protect, trendingReport);

export default router;
