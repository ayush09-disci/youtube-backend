import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// same concept as toggle subscription
// case 1 : If user already liked the video then dlete the doc by id
//case 2 : If not liked then creat the like doc
// get teh videoId by req.params
// validate the req.user?._id
// find the likeExist by findOne
// if already liked then delete
// else create the new like doc
// return response
const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    throw new ApiError(400, "VideoId is required");
  }

  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized");
  }

  try {
    const isLikeExist = await Like.exists({
      video: videoId,
      likedBy: req.user._id,
    });
    if (isLikeExist) {
      await Like.findOneAndDelete({
        video: videoId,
        likedBy: req.user._id,
      });
      return res
        .status(200)
        .json(
          new ApiResponse(200, { liked: false }, "Video Unliked Successsfully")
        );
    }

    // case 2
    const like = await Like.create({
      video: videoId,
      likedBy: req.user._id,
    });

    return res
      .status(200)
      .json(new ApiResponse(200, { liked: true }, "Video Liked Successsfully"));
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error : While Toggling the Like");
  }
});

// same concept as toggle subscription
// case 1 : If user already liked the comment then dlete the doc by id
//case 2 : If not liked then creat the commnet doc
// get teh commentId by req.params
// validate the req.user?._id
// same concept but new flow
// first findOneandDelete by commentid and req.user.id
// if this success then return unlike successfull
// else create the like.doc
// return response
const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid commentId");
  }

  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized");
  }

  try {
    const deletedLike = await Like.findOneAndDelete({
      comment: commentId,
      likedBy: req.user._id,
    });
    if (deletedLike) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { liked: false },
            "Comment Unliked Successsfully"
          )
        );
    }

    const commentLike = await Like.create({
      comment: commentId,
      likedBy: req.user._id,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(200, { liked: true }, "Comment Liked Successsfully")
      );
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error : While Toggling the Comment Like");
  }
});

// same concept as toggle subscription
// case 1 : If user already liked the tweet then dlete the doc by id
//case 2 : If not liked then creat the tweet doc
// get teh tweetId by req.params
// validate the req.user?._id
// same concept but new flow
// first findOneandDelete by tweetid and req.user.id
// if this success then return unlike successfull
// else create the like.doc
// return response
const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid commentId");
  }

  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized");
  }

  try {
    const deletedLike = await Like.findOneAndDelete({
      tweet: tweetId,
      likedBy: req.user._id,
    });
    if (deletedLike) {
      return res
        .status(200)
        .json(
          new ApiResponse(200, { liked: false }, "Tweet Unliked Successsfully")
        );
    }

    const tweetLike = await Like.create({
      tweet: tweetId,
      likedBy: req.user._id,
    });

    return res
      .status(200)
      .json(new ApiResponse(200, { liked: true }, "Tweet Liked Successsfully"));
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error : While Toggling the Tweet Like");
  }
});

// get teh userId from req.params
// validate the req.user._id;
// aggregate using match => owner : req.user and video => thumbnail , username , title
//count doc for total liked video
// return response
const getLikedVideos = asyncHandler(async (req, res) => {
  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized");
  }

  try {
    // video: { $exists: true }
    // 👉 Means:
    // “Only select documents where the video field exists”
    const likes = await Like.aggregate([
      {
        $match: {
          likedBy: new mongoose.Types.ObjectId(req.user._id),
          video: { $exists: true },
        },
      },
      {
        $lookup: {
          from: "videos",
          localField: "video",
          foreignField: "_id",
          as: "video",
          pipeline: [
            {
              $project: {
                thumbnail: 1,
                title: 1,
                owner: 1,
                views: 1,
                duration: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$video", // convert array to object
      },
    ]);

    const totalLikedVideos = await Like.countDocuments({
      likedBy: req.user._id,
      video: { $exists: true },
    });
    if (!likes.length) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { likes: [], totalLikedVideos: 0 },
            "No liked videos"
          )
        );
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { likes, totalLikedVideos },
          "Liked Videos fetched successfully"
        )
      );
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error : While fetching the liked videos");
  }
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
