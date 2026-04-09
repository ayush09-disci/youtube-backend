import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { commentSortBy, commentTypes } from "../constants.js";

// get the videoId from req.params
//get the limit , page , sortType and sortOrder from req.query;
//aggregate and match the _id : videoId and look to user for avatar and username
//sort and limit in aggregate only
// return response
const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  let { limit = 5, sortBy = "newest" } = req.query;

  if (!isValidObjectId(videoId)) {
    throw new Error(400, "Invlaid VideoId or videoId is required");
  }

  limit = parseInt(limit);

  //check the sortType
  if (!commentSortBy.includes(sortBy)) {
    throw new Error(400, "Invlaid SortBy type");
  }

  let sortOption = {};
  //here we sortType is fixed that is createdAt
  const sortType = "createdAt";
  if (sortBy) {
    sortOption[sortType] = sortBy === "newest" ? -1 : 1;
  }

  try {
    const comments = await Comment.aggregate([
      {
        $match: {
          video: new mongoose.Types.ObjectId(videoId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
          pipeline: [
            {
              $project: {
                username: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "comment",
          as: "commentLikes",
          pipeline: [
            {
              $count: "totalLikes",
              // "$count count the total document received by lookup and give it a name and dont return any other data"
            },
          ],
        },
      },
      {
        $unwind: "$owner",
      },
      {
        $addFields: {
          totalLikes: {
            // $ifNull: [ <value>, <defaultValue> ]
            // if value become null then use the default value otherwise use the value given
            $ifNull: [{ $arrayElemAt: ["$commentLikes.totalLikes", 0] }, 0],
          },
        },
      },
      {
        $sort: sortOption,
      },
      {
        $limit: limit,
      },
      {
        project: {
          commentLikes: 0,
          // give all deatil except the commentLikes
        },
      },
    ]);
    if (!comments.length) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No Comment on video"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, comments, "Comment fetched successfully on video")
      );
  } catch (error) {
    console.error(error);
    throw new ApiError(
      500,
      "Server Error : While fetching the comment on video"
    );
  }
});

// get the content from the req.body
// get the type typeId from req.params
//validate the req.user
//check the commetn type
// create the creationfield with [type] : id , owner and content
// return response
const addComment = asyncHandler(async (req, res) => {
  const { type, typeId } = req.params;
  const { content } = req.body;
  if (!content) {
    throw new ApiError(400, "Content is required");
  }
  if (!type || !typeId) {
    throw new ApiError(400, "type and id is required");
  }
  if (!isValidObjectId(typeId)) {
    throw new ApiError(400, "Invalid Video Id");
  }
  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized");
  }

  //validate the commentTypes
  if (!commentTypes.includes(type)) {
    throw new ApiError(400, "Invalid comment Type");
  }

  const commentData = {
    [type]: typeId, // dynamic field, // video : videoId
    content: content,
    owner: req.user._id,
  };

  try {
    const createdComment = await Comment.create(commentData);
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          createdComment,
          `Comment added to ${type} Successfully`
        )
      );
  } catch (error) {
    console.error(error);
    throw new ApiError(500, `Server Error : Failed to comment on ${type}`);
  }
});

//get the videoId
//validate  content
// find the comment by id check the owner
// findByIdAndUpdate
//    OR
//findOneAndUpdate then on need to check the owner
//return response
const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.param;
  const { content } = req.body;

  if (!content) {
    throw new ApiError(400, "Content is required");
  }
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid Video Id");
  }
  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized");
  }

  try {
    //no need to first find then check the owner
    const updatedComment = await Comment.findOneAndUpdate(
      {
        _id: commentId,
        owner: req.user._id,
      },
      {
        $set: {
          content: content,
        },
      },
      { new: true }
    );
    if (!updatedComment) {
      throw new ApiError(404, "Comment not found or not authorized");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, updatedComment, "Comment updated successfully")
      );
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error while updating comment");
  }
});

//gte the commentId
// find the comment by id and check the owner
// findByIdAndDelete
//    OR
//findOneAndDelete then on need to check the owner
//return response
const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }

  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized");
  }

  try {
    //no need to first find then check the owner
    //findone does it for u => check both condition
    const deletedComment = await Comment.findOneAndDelete({
      _id: commentId,
      owner: req.user._id,
    });
    if (!deletedComment) {
      throw new ApiError(404, "Comment not found or not authorized");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, deletedComment, "Comment deleted successfully")
      );
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error while deleting comment");
  }
});

export { getVideoComments, addComment, updateComment, deleteComment };
