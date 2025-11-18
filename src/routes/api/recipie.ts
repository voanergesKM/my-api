import { Router } from "express";
import { receiptOcrController } from "~/controllers/receiptOcrController.js";
import { scanRecipieHandler } from "~/controllers/scanRecipie.js";
import { upload } from "~/middlewares/upload.js";
import { verifySignature } from "~/middlewares/verifySignature.js";
import { asyncHandler } from "~/utils/async-handler.js";

const router = Router();

router.post(
  "/",
  verifySignature,
  upload.single("file"),
  asyncHandler(scanRecipieHandler),
);

router.post(
  "/ocr",
  verifySignature,
  upload.single("file"),
  asyncHandler(receiptOcrController),
);

export { router as recipieRoutes };
