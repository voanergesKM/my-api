import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadReceiptImage(
  filePath: string,
): Promise<{ imageUrl: string; publicId: string }> {
  const uploadResult = await cloudinary.uploader.upload(filePath, {
    folder: "receipts",
    use_filename: true,
    unique_filename: false,
  });

  return {
    imageUrl: uploadResult.secure_url,
    publicId: uploadResult.public_id,
  };
}

export async function deleteReceiptImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}
