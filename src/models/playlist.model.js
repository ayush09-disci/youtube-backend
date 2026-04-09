import mongoose, { Schema } from "mongoose";

const playlistSchema = new Schema(
  {
    videos: [
      {
        type: mongoose.Types.ObjectId(),
        ref: "Video",
      },
    ],
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    owner: {
      type: mongoose.Types.ObjectId(),
      ref: "User",
    },
    visibility: {
      type: Enumerator,
      default: "private",
    },
  },
  { timestamps: true }
);

export const Playlist = mongoose.model("Playlist", playlistSchema);
