import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginateV2 from "mongoose-aggregate-paginate-v2";

const commentSchema = new Schema(
  {
    content: {
      type: String,
      required: true,
    },
    video: {
      type: mongoose.Types.ObjectId(),
      ref: "Video",
    },
    owner: {
      type: mongoose.Types.ObjectId(),
      ref: "User",
    },
    tweet: {
      type: mongoose.Types.ObjectId(),
      ref: "Tweet",
    },
  },
  { timestamps: true }
);

commentSchema.plugin(mongooseAggregatePaginateV2);
export const Comment = mongoose.model("Comment", commentSchema);
