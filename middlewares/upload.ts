import multer from "multer";

const multerConfig = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

export const upload = multer({
  storage: multerConfig,
});
