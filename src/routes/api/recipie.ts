import { Router } from "express";
import { receiptOcrController } from "~/controllers/receiptOcrController.js";
import { scanRecipieHandler } from "~/controllers/scanRecipie.js";
import { upload } from "~/middlewares/upload.js";
import { asyncHandler } from "~/utils/async-handler.js";

const router = Router();

router.post("/", upload.single("file"), asyncHandler(scanRecipieHandler));
router.patch("/ocr", upload.single("file"), asyncHandler(receiptOcrController));

export { router as recipieRoutes };
