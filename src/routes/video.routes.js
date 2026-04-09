import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware";
import {
  deleteVideo,
  getAllVideos,
  getVideoById,
  publishAVideo,
  togglePublishStatus,
  updateVideo,
} from "../controllers/video.controller";
import { upload } from "../middlewares/multer.middleware";

const router = Router();

//apply the verifyJWT to all routes
// router.use(verifyJWT);

//get the videos
router.route("/").get(getAllVideos);
//publish video
router.route("/publish-video").post(
  verifyJWT,
  upload.fields[
    ({
      name: "video",
      maxCount: 1,
    },
    {
      name: "thumbnail",
      maxCount: 1,
    })
  ],
  publishAVideo
);
// get video by id
router.route("/:videoId").get(getVideoById);
//update video
router
  .route("/update/:videoId")
  .patch(verifyJWT, upload.single("thumbnail"), updateVideo);
//delete  video
router.route("/delete/:videoId").delete(verifyJWT, deleteVideo);
//toggle the status
router.route("/toggle/publish/:videoId").patch(verifyJWT, togglePublishStatus);
