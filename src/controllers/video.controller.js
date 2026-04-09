import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

// http://localhost:5000/videos?category=music&sort=latest
// Here:
// {category=music
// sort=latest}
// get the page , limit , query , sortBy , sortType , userId from req.query
// convert the page and limit to int
// set teh skip = (page-1) * limit;  => skip mean if we are page 3 then skip 20 video if limit is 10
// set the filter => title = {query,options} and owner = userId
//set the sortOptions using the sortby and sortType
// find the video based on filter . sort by sortoptions , skip by skip and limit by limit
// count the total videos
// return ApiResponse
const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query,
    sortBy = "createdAt",
    sortType = "desc",
    userId,
  } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);

  let filter = {};

  if (query) {
    filter.title = {
      $regex: query,
      $options: "i",
    };
  }

  if (userId) {
    filter.owner = userId;
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortType === "asc" ? 1 : -1;

  try {
    const videos = await Video.find(filter)
      .sort(sortOptions)
      .limit(limit)
      .skip(skip);

    if (!videos) {
      throw new ApiError(404, "Videos not found");
    }

    const totalVideos = await Video.countDocuments(filter);

    const data = {
      page: page,
      success: true,
      totalPages: Math.ceil(totalVideos / limit),
      totalVideos,
      videos,
    };

    return res
      .status(200)
      .json(new ApiResponse(200, data, "Videos fetched successfully"));
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Failed to fetch videos");
  }
});

// get the titl description from the req.body
// get the videoPath with req.file?.path using multer
//upload on cloudinary
// validate
//create the video with given data
//return response

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) {
    throw new ApiError(400, "Title and description are required");
  }
  // TODO: get video, upload to cloudinary, create video
  const videoLocalPath = req.files?.video?.[0].path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0].path;
  if (!videoLocalPath || !thumbnailLocalPath) {
    throw new ApiError(400, "Video or thumbnail path not found");
  }

  try {
    const [video, thumbnail] = await Promise.all([
      uploadOnCloudinary(videoLocalPath),
      uploadOnCloudinary(thumbnailLocalPath),
    ]);
    if (!video || !thumbnail) {
      throw new ApiError(500, "Video or thumbnail upload failed on cloudinary");
    }
    // create
    const createdVideo = await Video.create({
      videoFile: video?.secure_url,
      thumbnail: thumbnail?.secure_url,
      title,
      description,
      duration: video?.duration,
      isPublished: true,
      owner: req.user._id,
    });

    return res
      .status(200)
      .json(new ApiResponse(200, createdVideo, "Video published successfully"));
  } catch (error) {
    console.error(error);
    throw new ApiError(400, "Error while publishing the video");
  }
});

// /video/:videoId
// get the public id of video => videoId from params
// get the video from db using the videoId
// return
const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    throw new ApiError(400, "Invalid or video Id not found");
  }

  try {
    const video = await Video.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(videoId),
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
              $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscriber",
              },
            },
            {
              $addFields: {
                subscriberCount: {
                  $size: "$subscriber",
                },
              },
            },
            {
              $project: {
                username: 1,
                avatar: 1,
                subscriberCount: 1,
              },
            },
          ],
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
        $lookup: {
          from: "comments",
          localField: "_id",
          foreignField: "video",
          as: "comments",
        },
      },
      {
        $addFields: {
          owner: {
            $arrayElemAt: ["$owner", 0], // => array to object
          },
          likes: {
            $size: "$likes",
          },
          comments: {
            $size: "$comments",
          },
        },
      },
    ]);

    //convert video array to object as aggregate return array
    // video = [ {...} ]
    // video[0]

    if (!video.length) {
      throw new ApiError(404, "Video not found");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, video[0], "Video Successfully fetched by Id"));
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Error fetching the video");
  }
});

// get the videoID from params
// get the title description  to update from req.body
///thumbnail from req.file?.videoPath
//upload thumbnail on cloudinary
// findByIdAndUpdate using videoId
//return response
const updateVideo = asyncHandler(async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!videoId) {
      throw new ApiError(400, "Video Not found");
    }

    const { title, description } = req.body;
    const thumbnailLocalPath = req.file?.path;
    if (!title && !description && !thumbnailLocalPath) {
      throw new ApiError(400, "One of the filed is required for updation");
    }
    //i want user to update any one or two or all three field so if he dont give me thumbnail i will use the previos One

    const updationField = {};

    if (title) updationField.title = title;
    if (description) updationField.description = description;

    if (thumbnailLocalPath) {
      const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
      if (!thumbnail) {
        throw new ApiError(500, "failed to uplaod image on cloudinary");
      }
      updationField.thumbnail = thumbnail.url;
    }

    console.log(updationField);

    const updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      {
        $set: updationField,
      },
      { new: true }
    );

    if (!updatedVideo) {
      throw new ApiError(404, "Failed to update the video");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, updatedVideo, "Video details updated successfully")
      );
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Errror while updating the video");
  }
});

//get the videoId from the req.params
//find the video in db and delete
//return response
const deleteVideo = asyncHandler(async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!videoId) {
      throw new ApiError(400, "Invalid video id");
    }

    const deletedVideo = await Video.findByIdAndDelete(videoId);
    if (!deleteVideo) {
      throw new ApiError(404, "Failed to delete the video");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, true, "Video deleted successfully"));
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Error while deleting the video");
  }
});

//toggle publish mean set isPublished to true of false based on prvious state
//this help the backendd to sort the video to show on frontend
//algo
//get the videoId from req.params
//find the video by id
//set the isPublished
//save
//return response
const togglePublishStatus = asyncHandler(async (req, res) => {
  try {
    const { videoId } = req.params;
    if (!videoId) {
      throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);
    if (!video) {
      throw new ApiError(404, "Video not found");
    }

    video.isPublished = !video.isPublished;
    await video.save();

    return res
      .status(200)
      .json(new ApiResponse(200, video, "Publish status toggled successfully"));
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Error while toggling the status");
  }
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
