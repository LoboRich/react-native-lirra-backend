import express from 'express';
import cloudinary from '../lib/cloudinary.js';
import ReadingMaterial from '../models/ReadingMaterial.js';
import protectRoute from '../middleware/auth.middleware.js';
import Vote from '../models/Vote.js';

const router = express.Router();

router.post('/', protectRoute, async(req, res) => {
    try {
        const {title, type, caption, author, image} = req.body;

        if(!title || !caption || !image) {
            return res.status(400).json({message: 'Please provide all required fields'});
        }
        // upload image to cloudinary
        const uploadResponse = await cloudinary.uploader.upload(image)
        const imageUrl = uploadResponse.secure_url;

        const newReadingMaterial = await ReadingMaterial.create({
            title,
            type,
            caption,
            author,
            image: imageUrl,
            user: req.user._id
        });

        await newReadingMaterial.save();

        res.status(201).json(newReadingMaterial);
    } catch (error) {
        console.log("Error creating reading material", error);
        res.status(500).json({message: error.message});
    }
})

router.get("/", protectRoute, async (req, res) => {
    try {
      // pagination + search params
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.max(1, parseInt(req.query.limit, 10) || 5);
      const skip = (page - 1) * limit;
      const search = req.query.search?.trim() || "";
  
      // build search condition
      const searchCondition = search
        ? { title: { $regex: search, $options: "i" } }
        : {};
  
      // query docs + total count in parallel
      const [materials, totalReadingMaterials] = await Promise.all([
        ReadingMaterial.find(searchCondition)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("user", "username profileImage"),
        ReadingMaterial.countDocuments(searchCondition),
      ]);
  
      // attach votes info for each material
      const results = await Promise.all(
        materials.map(async (material) => {
          const [votesCount, hasVoted] = await Promise.all([
            Vote.countDocuments({ material: material._id }),
            Vote.exists({ material: material._id, user: req.user._id }),
          ]);
  
          return {
            ...material.toObject(),
            votesCount,
            hasVoted: !!hasVoted,
          };
        })
      );
  
      res.json({
        readingMaterials: results,
        currentPage: page,
        totalReadingMaterials,
        totalPages: Math.ceil(totalReadingMaterials / limit),
      });
    } catch (error) {
      console.error("Error getting reading materials:", error);
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

export default router;