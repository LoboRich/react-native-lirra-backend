import express from "express";
import Vote from "../models/voteModel.js";  // adjust path to your model
import protectRoute from '../middleware/auth.middleware.js';

const router = express.Router();

router.post("/:materialId", protectRoute, async (req, res) => {
  try {
    const { materialId } = req.params;
    const userId = req.user._id;

    // upsert vote (ensures only one vote per user per material)
    await Vote.findOneAndUpdate(
      { user: userId, material: materialId },
      {},
      { upsert: true, new: true }
    );

    res.json({ message: "Vote recorded successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:materialId", protectRoute, async (req, res) => {
  try {
    const { materialId } = req.params;
    const userId = req.user._id;

    await Vote.findOneAndDelete({ user: userId, material: materialId });

    res.json({ message: "Vote removed successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:materialId", async (req, res) => {
  try {
    const { materialId } = req.params;

    const totalVotes = await Vote.countDocuments({ material: materialId });

    res.json({ materialId, totalVotes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;