import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: [String], // now an array
      required: true,
      enum: [
        "theft",
        "assault",
        "fire",
        "medical",
        "vandalism",
        "substance",
        "unauthorized",
        "environmental",
        "protest",
      ],
    },
    area: {
      type: String,
      required: true,
    },
    locationDescription: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "in-progress", "resolved", "referred"],
      default: "pending",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    image: {
      type: String,
    },
    anonymous: {
      type: Boolean,
      default: false,
    },
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        text: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
reportSchema.index({ category: 1, status: 1, createdAt: -1 });

export default mongoose.model("Report", reportSchema);
