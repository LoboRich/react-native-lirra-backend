import express from "express";
import Vote from "../models/voteModel.js";  // adjust path to your model
import protectRoute from '../middleware/auth.middleware.js';

const router = express.Router();

router.post("/:materialId", protectRoute, async (req, res) => {
  try {
    const { materialId } = req.params;
    const userId = req.user._id;

    // check if vote already exists
    const existingVote = await Vote.findOne({ user: userId, material: materialId });

    if (existingVote) {
      // remove vote (toggle off)
      await Vote.deleteOne({ _id: existingVote._id });
      const votesCount = await Vote.countDocuments({ material: materialId });

      return res.json({
        message: "Vote removed",
        voted: false,
        votesCount,
      });
    } else {
      // add new vote (toggle on)
      await Vote.create({ user: userId, material: materialId });
      const votesCount = await Vote.countDocuments({ material: materialId });

      return res.json({
        message: "Vote added",
        voted: true,
        votesCount,
      });
    }
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