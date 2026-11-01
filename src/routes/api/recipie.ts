import { Router } from "express";
import multer from "multer";

import { receiptGeminiController } from "~/controllers/receiptGeminiController.js";
import { receiptOcrController } from "~/controllers/receiptOcrController.js";
import { scanRecipieHandler } from "~/controllers/scanRecipie.js";
import { upload } from "~/middlewares/upload.js";
import { verifySignature } from "~/middlewares/verifySignature.js";
import { asyncHandler } from "~/utils/async-handler.js";

const router = Router();
const geminiUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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

router.post(
  "/ocr/gemini",
  verifySignature,
  geminiUpload.single("file"),
  asyncHandler(receiptGeminiController),
);

export { router as recipieRoutes };
