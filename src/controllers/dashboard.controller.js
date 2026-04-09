import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

//total videos , total view , channel createdAt , subscriber , username , avatar
// get the channelID from the req.params
//aggregate and match video by owner and look up into like for total likes on each video
// group by null to get the total video and total view andd total likes
// for subscriber just coundOdcumnet where channel : channelID
//get the avatar and username from the User
//return stats
const getChannelStats = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  if (!isValidObjectId(channelId) || !channelId) {
    throw new ApiError(400, "Invlaid channelId or channelId is required");
  }

  try {
    const videos = await Video.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(channelId),
        },
      },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "video",
          as: "likes",
        },
      },
      {
        $addFields: {
          likeCount: {
            $size: "$likes",
          },
        },
      },
      {
        $group: {
          _id: null,
          totalVideos: { $sum: 1 },
          totalViews: { $sum: "$views" },
          totalLikes: { $sum: "$likeCount" },
        },
      },
      {
        $project: {
          totalVideos: 1,
          totalLikes: 1,
          totalViews: 1,
          _id: 0,
        },
      },
    ]);

    const totalSubscribers = await Subscription.countDocuments({
      channel: channelId,
    });
    const user = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(channelId),
        },
      },
      {
        $project: {
          username: 1,
          avatar: 1,
        },
      },
    ]);

    const stats = {
      totalVideos: videos[0]?.totalVideos || 0,
      totalLikes: videos[0]?.totalLikes || 0,
      totalViews: videos[0]?.totalViews || 0,
      totalSubscribers,
      username: user[0]?.username || "",
      avatar: user[0]?.avatar || "",
    };

    return res
      .status(200)
      .json(new ApiResponse(200, stats, "Channel stats fetched successsfully"));
  } catch (error) {
    console.error(error);
    throw new ApiError(
      500,
      "Server Error : While Fetching the stats of channel"
    );
  }
});

//get the channeID from the req.params
// aggregate and match with owner : channelId
/// project the requittred field like duration ,thumbnail,title,view,createdAt
// return response
const getChannelVideos = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invlaid channelId or channelId is required");
  }

  try {
    const channelVideos = await Video.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(channelId),
        },
      },
      {
        $project: {
          thumbnail: 1,
          duration: 1,
          title: 1,
          views: 1,
        },
      },
    ]);
    if (!channelVideos.length) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No Videos on channel"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, channelVideos, "No Videos on channel"));
  } catch (error) {
    console.error(error);
    throw new ApiError(
      500,
      "Server Error : While Fetching the videos of channel"
    );
  }
});

export { getChannelStats, getChannelVideos };
