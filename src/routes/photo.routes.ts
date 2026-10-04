import { Router } from "express";
import * as photoController from "../controllers/photo.controller";

const router = Router();

router.get("/", photoController.listByTag);

export default router;
