import express from "express";
import Vote from "../models/Vote.js";
import protectRoute from '../middleware/auth.middleware.js';

const router = express.Router();

router.post("/:materialId", protectRoute, async (req, res) => {
  try {
    const { materialId } = req.params;
    const userId = req.user._id;

    // Check if user already voted
    const existingVote = await Vote.findOne({ user: userId, material: materialId });

    // Count votes for display
    const votesCount = await Vote.countDocuments({ material: materialId });

    if (existingVote) {
      // User already voted → do nothing
      return res.json({
        message: "Already voted",
        voted: true,
        votesCount,
      });
    }

    // Add new vote
    await Vote.create({ user: userId, material: materialId });

    // Recount votes after adding
    const updatedVotesCount = await Vote.countDocuments({ material: materialId });

    return res.json({
      message: "Vote added",
      voted: true,
      votesCount: updatedVotesCount,
    });
  } catch (err) {
    console.error("Vote error:", err);
    res.status(500).json({ message: "Failed to record vote" });
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

router.get("/:materialId", protectRoute, async (req, res) => {
  try {
    const { materialId } = req.params;

    const totalVotes = await Vote.countDocuments({ material: materialId });

    res.json({ materialId, totalVotes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;