import vision from "@google-cloud/vision";

const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64 || "", "base64").toString(
    "utf8",
  ),
);

const visionClient = new vision.ImageAnnotatorClient({ credentials });

export async function detectText(
  filePath: string,
): Promise<string | undefined> {
  const [result] = await visionClient.textDetection(filePath);
  return result.textAnnotations?.[0]?.description ?? undefined;
}
