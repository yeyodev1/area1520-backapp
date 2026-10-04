import { Router } from "express";
import * as leadController from "../controllers/lead.controller";

const router = Router();

router.post("/", leadController.create);

export default router;
