import { Router } from "express";

import { scanRecipieHandler } from "../../controllers/scanRecipie.js";
import { upload } from "../../middlewares/upload.js";
import { asyncHandler } from "../../utils/async-handler.js";

const router = Router();

router.post("/", upload.single("file"), asyncHandler(scanRecipieHandler));

export { router as recipieRoutes };
