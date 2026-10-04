import express, { Application } from "express";
import authRoutes from "./auth.routes";
import healthRoutes from "./health.routes";
import albumRoutes from "./album.routes";
import photoRoutes from "./photo.routes";
import leadRoutes from "./lead.routes";
import adminRoutes from "./admin.routes";

function routerApi(app: Application) {
  const router = express.Router();
  app.use("/api", router);

  router.use("/health", healthRoutes);
  router.use("/auth", authRoutes);
  router.use("/albums", albumRoutes);
  router.use("/photos", photoRoutes);
  router.use("/leads", leadRoutes);
  router.use("/admin", adminRoutes);
}

export default routerApi;
