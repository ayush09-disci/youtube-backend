import { Router } from "express";
import { upload } from "../middlewares/multer.middleware";
import {
  createTweet,
  deleteTweet,
  getUserTweets,
  updateTweet,
} from "../controllers/tweet.controller";
import { verifyJWT } from "../middlewares/auth.middleware";

const router = Router();

router.route("/").post(verifyJWT, upload.single("image"), createTweet);
router.route("/:channelId").get(getUserTweets);
router.route("/:tweetId").patch(verifyJWT, upload.single("image"), updateTweet);
router.route("/:tweetId").delete(verifyJWT, deleteTweet);

export default router;
