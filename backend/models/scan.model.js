import mongoose from "mongoose";

const scanResultSchema = new mongoose.Schema({
  package: {
    type: String,
    required: true,
  },
  version: {
    type: String,
  },
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  riskLevel: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    required: true,
  },
  issues: [
    {
      type: String,
    },
  ],
});

const scanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    scanType: {
      type: String,
      enum: ["file", "name"],
      required: true,
    },
    fileName: {
      type: String,
    },
    packageName: {
      type: String,
    },
    results: [scanResultSchema],
  },
  {
    timestamps: true,
  },
);

const Scan = mongoose.model("Scan", scanSchema);

export default Scan;
