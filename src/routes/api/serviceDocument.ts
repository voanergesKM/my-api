import { Router } from "express";
import multer from "multer";
import { serviceDocumentController } from "~/controllers/serviceDocumentController.js";
import { verifySignature } from "~/middlewares/verifySignature.js";
import { asyncHandler } from "~/utils/async-handler.js";
const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
router.post(
  "/scan",
  verifySignature,
  upload.single("file"),
  asyncHandler(serviceDocumentController),
);
export { router as serviceDocumentRoutes };
