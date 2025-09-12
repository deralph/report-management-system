import fs from "fs";
import { cloudinary } from "../utils/cloudinary.js";
import Report from "../models/Report.js"; // assuming path
import nodemailer from "nodemailer";
import User from "../models/User.js";
import ChatMessage from "../models/chat.js";

const CATEGORY_ROLES = {
  security: ["theft", "assault", "vandalism", "unauthorized", "protest"],
  medical: ["medical"],
  special: ["fire", "environmental", "substance"],
};

const messageSystem = async (report, req, isUpdate) => {
  // Send system message to chat
  const systemUser = await User.findOne({ email: "davisheddie@gmail.com" });
  if (systemUser) {
    const messageText = `Case ${report.category.join(" || ")}: ${
      report.title
    } has been ${isUpdate ? "updated" : "created"}. Status: ${report.status}`;

    const systemMessage = new ChatMessage({
      user: systemUser._id,
      text: messageText,
    });

    await systemMessage.save();
    await systemMessage.populate("user", "name");

    const io = req.app.get("io");
    if (io) {
      const payload = {
        _id: systemMessage._id.toString(),
        user: systemMessage.user.name,
        userId: systemMessage.user._id,
        text: systemMessage.text,
        timestamp: systemMessage.createdAt,
        reactions: [],
      };

      io.to("community-chat").emit("receive-message", payload);
    }
  }
};

export const createReport = async (req, res) => {
  try {
    const {
      title,
      description,
      categories,
      area,
      locationDescription,
      anonymous,
      image,
    } = req.body;

    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
    }

    // 1️⃣ Create report
    const newReport = await Report.create({
      title,
      description,
      category: categories,
      area,
      locationDescription,
      anonymous: anonymous === true || anonymous === "true",
      image,
      createdBy: userId,
    });
    await messageSystem(newReport, req, false);
    // 2️⃣ Collect recipients
    let recipientRoles = new Set(["admin"]); // admins always notified

    categories.forEach((cat) => {
      for (const role in CATEGORY_ROLES) {
        if (CATEGORY_ROLES[role].includes(cat)) {
          recipientRoles.add(role);
        }
      }
    });

    const usersToNotify = await User.find({
      role: { $in: Array.from(recipientRoles) },
    });

    // 3️⃣ Send emails
    if (usersToNotify.length > 0) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });

      await Promise.all(
        usersToNotify.map((user) =>
          transporter.sendMail({
            from: `"Campus Security" <${process.env.MAIL_USER}>`,
            to: user.email,
            subject: "🚨 New Security Incident Reported",
            html: `
              <h3>New Report Submitted</h3>
              <p><strong>Title:</strong> ${title}</p>
              <p><strong>Categories:</strong> ${categories.join(", ")}</p>
              <p><strong>Area:</strong> ${area}</p>
              <p><strong>Location:</strong> ${locationDescription}</p>
              <p><strong>Description:</strong> ${description}</p>
            `,
          })
        )
      );
    }

    return res.json({
      success: true,
      message: "Report submitted and relevant staff notified",
      report: newReport,
    });
  } catch (error) {
    console.error("Error creating report:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      categories,
      status,
      area,
      locationDescription,
    } = req.body;

    // Ensure categories is always an array
    const categoryArray = Array.isArray(categories)
      ? categories
      : categories
      ? [categories]
      : [];

    // 1️⃣ Update the report
    const report = await Report.findByIdAndUpdate(
      id,
      {
        title,
        description,
        category: categoryArray,
        status,
        area,
        locationDescription,
      },
      { new: true }
    );

    if (!report) {
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });
    }
    await messageSystem(report, req, true);
    // 2️⃣ Collect recipient roles
    let recipientRoles = new Set(["admin"]); // always notify admins

    categoryArray.forEach((cat) => {
      for (const role in CATEGORY_ROLES) {
        if (CATEGORY_ROLES[role].includes(cat)) {
          recipientRoles.add(role);
        }
      }
    });

    const usersToNotify = await User.find({
      role: { $in: Array.from(recipientRoles) },
    });

    // 3️⃣ Send emails
    if (usersToNotify.length > 0) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });

      await Promise.all(
        usersToNotify.map((user) =>
          transporter.sendMail({
            from: `"Campus Security" <${process.env.MAIL_USER}>`,
            to: user.email,
            subject: "⚠️ Incident Report Updated",
            html: `
              <h3>Incident Report Updated</h3>
              <p><strong>Title:</strong> ${report.title}</p>
              <p><strong>Categories:</strong> ${report.category.join(", ")}</p>
              <p><strong>Status:</strong> ${report.status}</p>
              <p><strong>Area:</strong> ${report.area}</p>
              <p><strong>Location:</strong> ${report.locationDescription}</p>
              <p><strong>Description:</strong> ${report.description}</p>
              <p><em>This report has been updated. Please review the changes.</em></p>
            `,
          })
        )
      );
    }

    return res.json({
      success: true,
      message: "Report updated and relevant staff notified",
      report,
    });
  } catch (error) {
    console.error("Error updating report:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get trending incidents
export const trendingReport = async (req, res) => {
  console.log("in trending = ", req.query);

  try {
    const incidents = await Report.find()
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    console.log("trending incidents = ", incidents);

    res.status(200).json({
      status: "success",
      data: {
        incidents,
      },
    });
  } catch (error) {
    console.log("incident error = ", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Get all reports (for admin with filtering)
export const getAllReport = async (req, res) => {
  try {
    const { category, status, page = 1, limit = 10 } = req.query;

    // Build filter object
    const filter = {};
    if (category && category !== "all") filter.category = category;
    if (status && status !== "all") filter.status = status;

    // Execute query with pagination
    const reports = await Report.find(filter)
      .populate("createdBy", "name email")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total documents count
    const total = await Report.countDocuments(filter);

    res.status(200).json({
      status: "success",
      data: {
        reports,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Get user's reports
export const getUserReport = async (req, res) => {
  try {
    const reports = await Report.find({ createdBy: req.user.id })
      .populate("createdBy", "name email")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      data: reports,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
// Simpler approach to get report statistics
export const getReportStat = async (req, res) => {
  try {
    let query = {};

    // For non-admin users, only show their own stats
    if (req.user.role === "student") {
      query.createdBy = req.user.id;
    }

    // Get all matching reports
    const reports = await Report.find(query);

    // Manually calculate statistics
    const stats = {
      total: reports.length,
      pending: reports.filter((r) => r.status === "pending").length,
      inProgress: reports.filter((r) => r.status === "in-progress").length,
      resolved: reports.filter((r) => r.status === "resolved").length,
      referred: reports.filter((r) => r.status === "referred").length,
      byCategory: {}, // ✅ added
    };

    // Build category breakdown
    reports.forEach((r) => {
      const cat = r.category || "uncategorized";
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    });

    res.status(200).json({
      status: "success",
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching report stats:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Get single report
export const getSingleReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("assignedTo", "name")
      .populate("comments.user", "name");

    if (!report) {
      return res.status(404).json({
        status: "error",
        message: "Report not found",
      });
    }

    // Check if user has access to this report
    if (
      req.user.role === "student" &&
      report.createdBy._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        status: "error",
        message: "Not authorized to access this report",
      });
    }

    res.status(200).json({
      status: "success",
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Delete report image
export const deleteReportImage = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({
        status: "error",
        message: "Report not found",
      });
    }

    // Delete image from Cloudinary if exists
    if (report.images.length > 0) {
      const publicId = report.images[0].split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy(`security-reports/${publicId}`);
    }

    // Remove image from report
    const updatedReport = await Report.findByIdAndUpdate(
      reportId,
      { images: [] },
      { new: true }
    );

    res.status(200).json({
      status: "success",
      data: updatedReport,
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
// Delete report
export const deleteReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        status: "error",
        message: "Report not found",
      });
    }

    // Check if user can delete this report
    if (
      req.user.role === "student" &&
      report.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        status: "error",
        message: "Not authorized to delete this report",
      });
    }

    await Report.findByIdAndDelete(req.params.id);

    res.status(200).json({
      status: "success",
      data: null,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Add comment to report
export const postComment = async (req, res) => {
  try {
    const { text } = req.body;

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        status: "error",
        message: "Report not found",
      });
    }

    // Check if user has access to this report
    if (
      req.user.role === "student" &&
      report.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        status: "error",
        message: "Not authorized to comment on this report",
      });
    }

    report.comments.push({
      user: req.user.id,
      text,
    });

    await report.save();

    // Populate the new comment's user field
    await report.populate("comments.user", "name");

    res.status(201).json({
      status: "success",
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Get report statistics with category breakdown
export const reportStats = async (req, res) => {
  try {
    const { range = "all" } = req.query;

    // Calculate date range
    let dateFilter = {};
    if (range === "month") {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      dateFilter.createdAt = { $gte: oneMonthAgo };
    } else if (range === "week") {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      dateFilter.createdAt = { $gte: oneWeekAgo };
    }

    let match = { ...dateFilter };

    // For non-admin users, only show their own stats
    if (req.user.role === "student") {
      match.createdBy = req.user.id;
    }

    // Get basic stats
    const stats = await Report.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0] },
          },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
          },
          referred: {
            $sum: { $cond: [{ $eq: ["$status", "referred"] }, 1, 0] },
          },
        },
      },
    ]);

    // Get category breakdown
    const categoryStats = await Report.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Format category stats as an object
    const byCategory = {};
    categoryStats.forEach((item) => {
      byCategory[item._id] = item.count;
    });

    // If no reports found, return zeros
    const result =
      stats.length > 0
        ? stats[0]
        : {
            total: 0,
            pending: 0,
            inProgress: 0,
            resolved: 0,
            referred: 0,
          };

    // Add category breakdown to result
    result.byCategory = byCategory;

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Additional endpoint for trend data
export const statsTrend = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get daily report counts
    const dailyStats = await Report.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get status distribution
    const statusStats = await Report.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Format the response
    const trendData = {
      daily: dailyStats,
      byStatus: statusStats,
    };

    res.status(200).json({
      status: "success",
      data: trendData,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
