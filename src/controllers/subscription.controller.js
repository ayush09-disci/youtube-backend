import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// get the channelId from req.params
//check the channel exist or not
// case 1 if the user is already subscribed then unsubscribe by deleting the subscription => return subcrobed = false
//case 2 if user is not subscribed then ssubcribed by reating the subscription in which subscriber => user and channel => channelId  => return subcrobed = true
const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  if (!channelId || isValidObjectId(channelId)) {
    throw new ApiError(400, "Channel Id is required or Invalid channelID");
  }

  try {
    const channel = await User.exists({ _id: channelId });
    if (!channel) {
      throw new ApiError(404, "Channel Not found in DB");
    }

    //case 1 user already subscribed
    const isSubcribed = await Subscription.findOneAndDelete({
      subscriber: req.user?._id,
      channel: channelId,
    });
    if (isSubcribed) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { subcribed: false },
            "Unsubscribed Succeessfully"
          )
        );
    }

    //case 2 user is not subscribed
    const subscription = await Subscription.create({
      subscriber: req.user?._id,
      channel: channelId,
    });
    if (!subscription) {
      throw new ApiError(500, "Failed to create subscription");
    }
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { subscribed: true },
          "Channel Subscribed Successfully"
        )
      );
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error : While Toggling the subscription");
  }
});

// controller to return subscriber list of a channel
// get the channelId from the req.params and sortType SortOrder limit page from req.query,
// write the pipline where match channel => channelId and look up for subcriber in user to get the list of subscribers
// use aggregatePaginate for limit and pages
// return response
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  let {
    limit = 6,
    page = 1,
    sortType = "createdAt",
    sortOrder = "desc",
  } = req.query;

  if (!channelId || !isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid Channel Id or Channel Id is required");
  }

  limit = parseInt(limit);
  page = parseInt(page);
  let sortOptions = {};
  if (sortType) {
    sortOptions[sortType] = sortOrder === "desc" ? -1 : 1;
  }

  try {
    const pipeline = [
      {
        $match: {
          channel: new mongoose.Types.ObjectId(channelId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "subscriber",
          foreignField: "_id",
          as: "subscriber",
          pipeline: [
            {
              $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
              },
            },
            {
              $addFields: {
                subscriberCount: {
                  $size: "$subscribers",
                },
              },
            },
            {
              $project: {
                fullName: 1,
                avatar: 1,
                username: 1,
                subscriberCount: 1,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          subscriber: {
            $first: "$subscriber",
          },
        },
      },
      {
        $sort: sortOptions,
      },
      {
        $project: {
          subscriber: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ];

    const channelSubscribers = await Subscription.aggregatePaginate(pipeline, {
      limit,
      page,
    });
    if (!channelSubscribers.docs.length) {
      throw new ApiError(404, "Failed to fetch the channel subcribers");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          channelSubscribers,
          "Channel subscribers fetched successfully"
        )
      );
  } catch (error) {
    console.error(error);
    throw new ApiError(
      500,
      "Server Error : While fetching the channel subcribers"
    );
  }
});

// controller to return channel list to which user has subscribed
// get the userid or SubcribrId from req.params
// aggregate in subscrition where match subcriber => user Id and lookup to user to get all channel details
//sort limit and page usig aggregatePaginate
//return response
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
  const { limit = 6, page = 1 } = req.query;

  if (!subscriberId || !isValidObjectId(subscriberId)) {
    throw new ApiError(
      400,
      "subscriberId is required or Invalid subscriber Id"
    );
  }

  try {
    const pipeline = [
      {
        $match: {
          subscriber: new mongoose.Types.ObjectId(subscriberId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "channel",
          foreignField: "_id",
          as: "channel",
          pipeline: [
            {
              $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
              },
            },
            {
              $addFields: {
                subscriberCount: {
                  $size: "$subscribers",
                },
              },
            },
            {
              $project: {
                fullName: 1,
                username: 1,
                avatar: 1,
                subscriberCount: 1,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          channel: {
            $first: "$channel",
          },
        },
      },
    ];

    const channelsSubscribedTo = await Subscription.aggregatePaginate(
      pipeline,
      {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 }, // desc cretadAt => latest first
      }
    );

    // {
    //   docs: [
    //     { channel: {...} },
    //     { channel: {...} }
    //   ],
    //   totalDocs: 100,
    //   limit: 10,
    //   page: 1,
    //   totalPages: 10,
    //   hasNextPage: true,
    //   hasPrevPage: false
    // }
    if (!channelsSubscribedTo.docs.length) {
      throw new ApiError(404, "Failed to found channelsSubscribedTo");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          channelsSubscribedTo,
          "Subscribed channels fetched successfully"
        )
      );
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error : While fetching the channels");
  }
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
