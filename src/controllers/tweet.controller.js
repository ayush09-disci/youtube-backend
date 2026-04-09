import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

//in yt twwet has written content and user can uplaod the image also but it not necessary to uplaod the imgae
// get the content from the req.body
//get the image from the req.file
//create the tweet with content
const createTweet = asyncHandler(async (req, res) => {
  let tweetData = {};
  const { content } = req.body;

  if (!content) {
    throw new ApiError(400, "Content is required");
  }
  tweetData.content = content;

  try {
    const imageLocalPath = req.file?.path;
    if (imageLocalPath) {
      const image = await uploadOnCloudinary(imageLocalPath);
      if (!image) {
        throw new ApiError(500, "Failed to uplaod image on cloudinary");
      }
      tweetData.image = image.url;
    }

    if (!req.user) {
      throw new ApiError(401, "Unauthorized");
    }
    tweetData.owner = req.user._id;

    const tweet = await Tweet.create(tweetData);
    if (!tweet) {
      throw new ApiError(404, "Failed to create Tweet");
    }

    return res
      .status(201)
      .json(new ApiResponse(201, tweet, "Tweet created Successfully"));
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Error while creating the tweet");
  }
});

// /:channelId/tweets?limit=10
// single tweet have owner avatar , username , content , image , likes , comments
// get the channelId from req.params
// get the limit from req.query
// using aggregation get the owner , likes ,comment , isLiked
// return response
const getUserTweets = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  let { limit = 7 } = req.query;
  if (!channelId) {
    throw new ApiError(400, "Channel name is required");
  }

  limit = parseInt(limit);

  const sortOptions = {
    createdAt: -1, // -1 => desc => mean latest post will come first
  };

  try {
    const tweets = await Tweet.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(channelId),
        },
      },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "tweet",
          as: "likes",
          pipeline: [
            {
              $project: {
                likedBy: 1,
              },
            },
          ],
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
                fullName: 1,
                username: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "comments",
          localField: "_id",
          foreignField: "tweet",
          as: "comments",
          pipeline: [
            {
              $project: {
                content: 1,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          likesCount: {
            $size: "$likes",
          },
          commentsCount: {
            // how many comments
            $size: "$comments",
          },
          comments: {
            $arrayElemAt: ["$comments", 0],
          }, // commnents with content
          owner: {
            $arrayElemAt: ["$owner", 0],
          },
          isLiked: {
            $cond: {
              if: {
                $in: [
                  req.user._id,
                  {
                    $map: {
                      input: "$likes",
                      as: "like",
                      in: "$$like.likedBy",
                    },
                  },
                ],
              },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          content: 1,
          commentsCount: 1,
          likesCount: 1,
          owner: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);

    //aggregation always returns an array
    if (!tweets.length) {
      throw new ApiError(404, "Tweets not found");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, tweets[0], "Tweets fetched successfully"));
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error : While fetching the tweets");
  }
});

// get the content => req.body or image => req.file?.path to upadte from user and tweetId
//check the req.user match with tweet.owner
//uplaod the image to cloudinary
//findByIdndUpdate the tweet
//return response
const updateTweet = asyncHandler(async (req, res) => {
  let updationData = {};
  const { content } = req.body;
  const { tweetId } = req.params;
  if (!tweetId) {
    throw new ApiError(400, "Tweet Id in required for updation");
  }
  if (!content && !req.file?.path) {
    throw new ApiError(400, "One of the field is required for updation");
  }

  try {
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
      throw new ApiError(404, "Tweet not found");
    }

    //check the owner
    if (tweet.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "Only owner can update the tweet");
    }

    if (content) {
      updationData.content = content;
    }
    const imageLocalPath = req.file?.path;
    if (imageLocalPath) {
      const image = await uploadOnCloudinary(imageLocalPath);
      if (!image) {
        throw new ApiError(500, "Failed to upload the updated image");
      }
      updationData.image = image.url;
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
      tweetId,
      {
        $set: updationData,
      },
      { new: true }
    );
    if (!updatedTweet) {
      throw new ApiError(500, "Failed to update the tweet");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"));
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error : While Updating the Tweet");
  }
});

// get the tweetId
//check the req.user match with tweet.owner
//findByIdAndDelete
//return res
const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  if (!tweetId) {
    throw new ApiError(400, "Tweet Id is required");
  }
  if (!req.user) {
    throw new ApiError(400, "Unauthorized");
  }

  try {
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
      throw new ApiError(404, "Tweet not found");
    }

    //check the owner
    if (tweet.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "Only owner can delete the tweet");
    }

    const deletedTweet = await Tweet.findOneAndDelete({
      // using any one field it will delete the tweet
      _id: tweetId,
      owner: req.user._id,
    });
    if (!deletedTweet) {
      throw new ApiError(500, "Failed to delete the tweet");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, true, "Tweet deleted successfully"));
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error : While Deleting the Tweet");
  }
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
