import express from 'express';
import cloudinary from '../lib/cloudinary.js';
import ReadingMaterial from '../models/ReadingMaterial.js';
import protectRoute from '../middleware/auth.middleware.js';
import Vote from '../models/Vote.js';

const router = express.Router();

router.post('/', protectRoute, async(req, res) => {
    try {
        const {title, type, caption, author, keywords, version, edition, subjectTitles} = req.body;

        if(!title || !author) {
            return res.status(400).json({message: 'Please provide all required fields'});
        }
        // upload image to cloudinary
        // const uploadResponse = await cloudinary.uploader.upload(image)
        // const imageUrl = uploadResponse.secure_url;

        const newReadingMaterial = await ReadingMaterial.create({
            title,
            type,
            caption,
            author,
            keywords,
            version,
            edition,
            subjectTitles,
            user: req.user._id
        });

        await newReadingMaterial.save();

        res.status(201).json(newReadingMaterial);
    } catch (error) {
        console.log("Error creating reading material", error);
        res.status(500).json({message: error.message});
    }
})

// GET /reading-materials
router.get("/", protectRoute, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const sortParam = req.query.sort || "newest";
    const keywordFilter = req.query.keyword?.trim() || "";

    // Build base match filter
    const match = {};
    if (search) match.title = { $regex: search, $options: "i" };
    if (keywordFilter) match.keywords = { $regex: keywordFilter, $options: "i" };

    // ---- AGGREGATION PIPELINE ----
    const pipeline = [
      { $match: match },

      // Lookup user info
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userDoc",
        },
      },
      { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: true } },

      // Lookup votes and count them efficiently
      {
        $lookup: {
          from: "votes",
          let: { materialId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$material", "$$materialId"] } } },
            { $count: "count" },
          ],
          as: "votesAgg",
        },
      },

      // Add votesCount as a numeric field
      {
        $addFields: {
          votesCount: {
            $cond: [
              { $gt: [{ $size: "$votesAgg" }, 0] },
              { $arrayElemAt: ["$votesAgg.count", 0] },
              0,
            ],
          },
        },
      },
    ];

    if (sortParam !== "keywords") {
      // ---- SORTING LOGIC ----
      if (sortParam === "popular") {
        // Sort by votesCount (descending), then by createdAt (descending)
        pipeline.push({ $sort: { votesCount: -1, createdAt: -1 } });
      } else {
        // Default to "newest" sorting (by createdAt, descending)
        pipeline.push({ $sort: { createdAt: -1 } });
      }
    }

    // ---- FINAL PROJECTION (clean output) ----
    pipeline.push({
      $project: {
        title: 1,
        type: 1,
        caption: 1,
        author: 1,
        keywords: 1,
        createdAt: 1,
        votesCount: 1,
        user: {
          _id: "$userDoc._id",
          username: "$userDoc.username",
          profileImage: "$userDoc.profileImage",
        },
      },
    });

    // ---- PAGINATION ----
    pipeline.push({ $skip: skip }, { $limit: limit });

    // ---- EXECUTE AGGREGATION ----
    const materials = await ReadingMaterial.aggregate(pipeline);

    // ---- DETERMINE USER'S VOTES ----
    const materialIds = materials.map((m) => m._id);
    const userVotedMaterialIds =
      materialIds.length > 0
        ? await Vote.find({
            material: { $in: materialIds },
            user: req.user._id,
          }).distinct("material")
        : [];

    // Map hasVoted flag
    const results = materials.map((m) => ({
      ...m,
      hasVoted: userVotedMaterialIds
        .map((id) => id.toString())
        .includes(m._id.toString()),
    }));

    // ---- TOTAL COUNT (for pagination) ----
    const totalReadingMaterials = await ReadingMaterial.countDocuments(match);

    // ---- RESPONSE ----
    res.json({
      readingMaterials: results,
      currentPage: page,
      totalReadingMaterials,
      totalPages: Math.ceil(totalReadingMaterials / limit),
    });
  } catch (err) {
    console.error("Error getting reading materials:", err);
    res.status(500).json({ message: "Failed to fetch reading materials" });
  }
});

router.get("/user/materials", protectRoute, async (req, res) => {
  try {
    const { filter } = req.query; // "recommended" or "voted"
    const userId = req.user._id;

    let readingMaterials = [];
    
    if (filter === "voted") {
      // Materials the user voted on
      const votes = await Vote.find({ user: userId }).populate({
        path: "material",
        populate: { path: "user", select: "name email" }, // include uploader info
      });

      readingMaterials = votes
        .map((vote) => vote.material)
        .filter((m) => m != null);
    } else {
      // User’s own uploaded materials
      readingMaterials = await ReadingMaterial.find({ user: userId })
        .sort({ createdAt: -1 })
        .populate("user", "name email");
    }

    res.json({ readingMaterials });
  } catch (error) {
    console.error("Error fetching user materials:", error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', protectRoute, async(req, res) => {
    try {
        const readingMaterial = await ReadingMaterial.findById(req.params.id);
        if(!readingMaterial) {
            return res.status(404).json({message: 'Reading material not found'});
        }

        if(readingMaterial.user.toString() !== req.user._id) {
            return res.status(401).json({message: 'You are not authorized to delete this reading material'});
        }

        // delete image from cloudinary
        if(readingMaterial.image && readingMaterial.image.includes('cloudinary')) {
            try {
                const publicId = readingMaterial.image.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(publicId);
            } catch (error) {
                console.log("Error deleting image from cloudinary", error);
            }
        }

        await readingMaterial.deleteOne();
        res.status(200).json({message: 'Reading material deleted successfully'});
    } catch (error) {
        console.log("Error deleting reading material", error);
        res.status(500).json({message: error.message});
    }
})

// Approve a reading material
router.patch("/:id/approve", protectRoute, async (req, res) => {
  try {
    const { id } = req.params;

    const material = await ReadingMaterial.findByIdAndUpdate(
      id,
      { is_approved: true },
      { new: true }
    );

    if (!material) {
      return res.status(404).json({ message: "Reading material not found" });
    }

    res.json({ message: "Reading material approved successfully", material });
  } catch (err) {
    console.error("Error approving reading material:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/approved", protectRoute, async (req, res) => {
  try {
    const approvedMaterials = await ReadingMaterial.find({ is_approved: true })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json({ readingMaterials: approvedMaterials });
  } catch (err) {
    console.error("Error fetching approved reading materials:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:id/subject-titles", protectRoute, async (req, res) => {
  try {
    const { subjectTitles } = req.body;

    if (!Array.isArray(subjectTitles)) {
      return res.status(400).json({ message: "subjectTitles must be an array" });
    }

    const material = await ReadingMaterial.findByIdAndUpdate(
      req.params.id,
      { subjectTitles },
      { new: true }
    );

    if (!material) {
      return res.status(404).json({ message: "Reading material not found" });
    }

    res.json({ message: "Subject titles updated successfully", material });
  } catch (error) {
    console.error("Error updating subject titles:", error);
    res.status(500).json({ message: "Failed to update subject titles" });
  }
});

// GET /api/reading-materials/keywords
router.get("/keywords", async (req, res) => {
  try {
    const materials = await ReadingMaterial.find({}, "keywords");
    const freq = {};

    materials.forEach((m) => {
      m.keywords.forEach((k) => {
        freq[k] = (freq[k] || 0) + 1;
      });
    });

    const result = Object.entries(freq).map(([word, count]) => ({ word, count }));
    res.json(result);
  } catch (err) {
    console.error("Error fetching keywords:", err);
    res.status(500).json({ message: "Failed to fetch keywords" });
  }
});


export default router;