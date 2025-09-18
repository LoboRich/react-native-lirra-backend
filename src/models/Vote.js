import mongoose from "mongoose";

const voteSchema = new mongoose.Schema(
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      material: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ReadingMaterial",
        required: true,
      },
    },
    { timestamps: true }
);
  
// prevent same user voting twice on the same material
voteSchema.index({ user: 1, material: 1 }, { unique: true });

const Vote = mongoose.model("Vote", voteSchema);

export default Vote;  