import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { authMiddleware } from "../middlewares/auth.middleware";
import { adminMiddleware } from "../middlewares/admin.middleware";
import { uploadMiddleware } from "../middlewares/upload.middleware";
import { CustomError } from "../errors/customError.error";
import * as adminController from "../controllers/admin.controller";

const MAX_FILES = 20;

/** Traduce los errores de multer (demasiados archivos, archivo pesado) a un 400 legible. */
function receiveFiles(req: Request, res: Response, next: NextFunction) {
  uploadMiddleware.array("files", MAX_FILES)(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "Cada imagen puede pesar máximo 10 MB"
          : error.code === "LIMIT_UNEXPECTED_FILE"
            ? `Sube máximo ${MAX_FILES} imágenes en el campo "files"`
            : "No se pudieron recibir los archivos";
      next(new CustomError(message, 400));
      return;
    }
    next(error);
  });
}

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get("/stats", adminController.stats);

router.get("/leads", adminController.listLeads);
router.patch("/leads/:id", adminController.updateLead);
router.delete("/leads/:id", adminController.deleteLead);

router.get("/albums", adminController.listAlbums);
router.post("/albums", adminController.createAlbum);
router.patch("/albums/:id", adminController.updateAlbum);
router.delete("/albums/:id", adminController.deleteAlbum);
router.get("/albums/:id/photos", adminController.listAlbumPhotos);
router.post("/albums/:id/photos", receiveFiles, adminController.uploadAlbumPhotos);

router.patch("/photos/:id", adminController.updatePhoto);
router.delete("/photos/:id", adminController.deletePhoto);

export default router;
