import { Router } from "express";
import * as albumController from "../controllers/album.controller";

const router = Router();

router.get("/", albumController.list);
router.get("/:slug", albumController.getBySlug);
router.get("/:slug/photos", albumController.listPhotos);

export default router;
