import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { allowedVisiblity } from "../constants.js";
import { User } from "../models/user.model.js";

//get the name description and visibility from the req.body
//check the visibility is valid or not
//create the playlist with this data and owner => req.user?._id
// return response
const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description, visibility } = req.body;
  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized user");
  }

  //   What .some() does
  // 👉 It checks:
  // “Does at least ONE element in the array satisfy this condition?”
  if ([name, description, visibility].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  if (!allowedVisiblity.includes(visibility)) {
    throw new ApiError(400, "Invalid visibility option");
  }

  try {
    const createdPlaylist = await Playlist.create({
      owner: req.user._id,
      name,
      description,
      visibility,
    });
    if (!createdPlaylist) {
      throw new ApiError(500, "Failed to create the playlist");
    }

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          createdPlaylist,
          "New Playlist created successfully"
        )
      );
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error : While creating the playlist");
  }
});

// return all the playlost user has => each playlist has name , no. of videos and thumbnail
// user may be u or other youtuber
// get the userId from req.params
//chech the user exxist or Not
//aggregate and get teh videos total videos thumbnail description owner name cretaeAt updatedAt
// return response
const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new ApiError(400, "UserId is required");
  }

  try {
    const existedUser = await User.exists({ _id: userId });
    if (!existedUser) {
      throw new ApiError(404, "User not exist");
    }

    // get all playlist where owner = userId
    const userPlaylist = await Playlist.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "videos",
          localField: "videos",
          foreignField: "_id",
          as: "videos",
          pipeline: [
            {
              $project: {
                _id: 1,
                thumbnail: 1,
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
                _id: 1,
                username: 1,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          totalVideos: {
            $size: "$videos",
          },
          thumbnail: {
            $arrayElemAt: ["$videos.thumbnail", 0],
            //get the thumbnail of playlist by taking the first video thumbnail
          },
          videos: {
            $map: {
              input: "$videos",
              as: "video",
              in: "$$video._id",
              //convert the full video document into array of id only for optiomization
            },
            owner: {
              $first: "$owner",
            },
          },
        },
      },
      {
        $project: {
          owner: 1,
          description: 1,
          name: 1,
          videos: 1,
          totalVideos: 1,
          thumbnail: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);
    if (!userPlaylist.length) {
      throw new ApiError(500, "User playlist not found");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, userPlaylist, "User Playlist fetched successfully")
      );
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error : While fetching the User playlist ");
  }
});

//gte the playlist Id froom the req.params
//aggregate to find the playlist and also add
//video => id thumbnail and owner => usernmae , avatar
//return response
const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!playlistId) {
    throw new ApiError(400, "PlaylistId is required");
  }

  try {
    const existedPlaylist = await Playlist.exists({ _id: playlistId });
    if (!existedPlaylist) {
      throw new ApiError(404, "Playlist not found with this playlistId");
    }

    const playlist = await Playlist.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(playlistId),
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
          from: "videos",
          localField: "videos",
          foreignField: "_id",
          as: "videos",
          pipeline: [
            {
              $project: {
                _id: 1,
                thumbnail: 1,
                title: 1,
                duration: 1,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          videoCount: {
            $size: "$videos",
          },
          thumbnail: {
            $arrayElemAt: ["$videos.thumbnail", 0],
          },
          //   owner: "$owner", return owner array of one object
          owner: {
            $first: "$owner",
          },
          videos: "$videos",
        },
      },
      {
        $project: {
          name: 1,
          description: 1,
          owner: 1,
          videos: 1,
          videoCount: 1,
          thumbnail: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);

    if (!playlist.length) {
      throw new ApiError(404, "Playlist not found");
    }

    // aggreagate always return array of object to return playlist[0] if singlw objects
    return res
      .status(200)
      .json(new ApiResponse(200, playlist[0], "Playlist fetched successfully"));
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error : While fetching the playlist");
  }
});

// get the playlistId and videoId from the req.params
// find the Playlist by id and check the owner with rq.user._id
// check the video is already in playlist
// add video using $push in  findByIdAndUpdate
//return response
const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { videoId, playlistId } = req.params;
  if (!videoId || !playlistId) {
    throw new ApiError(400, "Both id are required");
  }

  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized User");
  }

  try {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      throw new ApiError(404, "Playlist not found");
    }

    //check the owner
    if (!playlist.owner.equals(req.user._id)) {
      throw new ApiError(403, "Only owner can add the video to playlist");
    }

    //   What .some() does
    // 👉 It checks:
    // “Does at least ONE element in the array satisfy this condition?”
    //check video already exxist
    if (playlist.videos.some((v) => v._id.toString() === videoId)) {
      throw new ApiError(400, "Video already exist");
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      playlistId,
      {
        $push: {
          videos: videoId,
        },
        // same but prevent duplicate values
        // $addToSet: {
        //     videos: videoId
        // }
      },
      { new: true }
    );
    if (!updatedPlaylist) {
      throw new ApiError(500, "Failed to add video into playlist");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, updatedPlaylist, "Video added to playlist"));
  } catch (error) {
    console.error(error);
    throw new ApiError(
      500,
      "Server Error : While adding the video to playlist"
    );
  }
});

// get the playlistid and videoId from req.params
//find the playlidt and check the owner
// check the videoexist or not in playlist
// if exist then findbyIdandUpdate using pull
//return resposne
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  if ([playlistId, videoId].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "Both id are required");
  }

  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized User");
  }

  try {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      throw new ApiError(404, "Playlist not found");
    }

    //check the owner
    if (!playlist.owner.equals(req.user?._id)) {
      throw new ApiError(403, "Only owner can remove the video to playlist");
    }

    //video exiist or not
    //if video not exist in playlist then we cannot remove it
    if (!playlist.videos.some((v) => v._id.toString() === videoId)) {
      throw new ApiError(400, "Video not exist in playlist");
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      playlistId,
      {
        $pull: {
          videos: videoId,
        },
      },
      { new: true }
    );

    if (!updatedPlaylist) {
      throw new ApiError(500, "Failed to remove video into playlist");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, updatedPlaylist, "Video removed from playlist")
      );
  } catch (error) {
    console.error(error);
    throw new ApiError(
      500,
      "Server Error : While removing the video from playlist"
    );
  }
});

// get the playlist id from the req.params
// find the playlist by id
//check the req.user._id match with video.owner
// findByidAndDelete the playlist
//return response
const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!playlistId) {
    throw new ApiError(400, "PlaylistId is required");
  }

  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized user");
  }

  try {
    const existingPlaylist = await Playlist.findById(playlistId);
    if (!existingPlaylist) {
      throw new ApiError(404, "Playlist not found");
    }

    if (!existingPlaylist.owner.equals(req.user?._id)) {
      throw new ApiError(403, "Only owner can delete the playlist");
    }

    //findOne check both conditon give better security
    const deletedPlaylist = await Playlist.findOneAndDelete({
      _id: playlistId,
      owner: req.user._id,
    });
    if (!deletedPlaylist) {
      throw new ApiError(500, "Failed to delete the playlist");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, { success: true }, "Playlist deleted successfully")
      );
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error : While deleting the playlist");
  }
});

// user can update the name and description and only one out of it also
//get teh playlistId
//gte the name description from the req.body
// check th req.user._id
// findbyId and update
//return response
const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!playlistId) {
    throw new ApiError(400, "PlaylistId is required");
  }
  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized user");
  }

  const { name, description } = req.body;

  let updationField = {};
  if (name) {
    updationField.name = name;
  }

  if (description) {
    updationField.description = description;
  }

  if (!name && !description) {
    throw new ApiError(400, "One of the field is required");
  }

  try {
    const existingPlaylist = await Playlist.findById(playlistId);
    if (!existingPlaylist) {
      throw new ApiError(404, "Playlist not found");
    }
    if (!existingPlaylist.owner.equals(req.user?._id)) {
      throw new ApiError(403, "Only owner can update the playlist");
    }

    //findOne check both conditon give better security
    const updatedPlaylist = await Playlist.findOneAndUpdate(
      {
        _id: playlistId,
        owner: req.user._id,
      },
      { $set: updationField },
      { new: true }
    );
    if (!updatedPlaylist) {
      throw new ApiError(500, "Failed to update the playlist");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
      );
  } catch (error) {
    console.error(error);
    throw new ApiError(500, "Server Error : While updating the playlist");
  }
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
