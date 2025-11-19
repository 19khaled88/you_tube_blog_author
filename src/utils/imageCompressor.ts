import sharp from "sharp";

const compressImage = async (imageBuffer: Buffer, maxSizeMB: number = 1): Promise<Buffer> => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  // Quick return if already small enough
  if (imageBuffer.length <= maxSizeBytes) {
    return imageBuffer;
  }

  console.log(`Starting compression: ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB -> ${maxSizeMB}MB target`);

  // Try multiple compression levels
  const attempts = [
    { width: 1200, quality: 70 }, // Balanced
    { width: 800, quality: 50 },  // Medium
    { width: 600, quality: 30 },  // Aggressive
    { width: 400, quality: 20 },  // Very aggressive
  ];

  let resultBuffer = imageBuffer;

  for (const attempt of attempts) {
    resultBuffer = await sharp(imageBuffer)
      .resize(attempt.width, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: attempt.quality,
        mozjpeg: true
      })
      .toBuffer();

    console.log(`  ${attempt.width}px @ ${attempt.quality}%: ${(resultBuffer.length / 1024 / 1024).toFixed(2)}MB`);

    // Stop if we're under the limit
    if (resultBuffer.length <= maxSizeBytes) {
      console.log(`✓ Successfully compressed to ${(resultBuffer.length / 1024 / 1024).toFixed(2)}MB`);
      break;
    }
  }

  // Final warning if still too large
  if (resultBuffer.length > maxSizeBytes) {
    console.log(`⚠️  Warning: Could not compress under ${maxSizeMB}MB. Final size: ${(resultBuffer.length / 1024 / 1024).toFixed(2)}MB`);
  }

  return resultBuffer;
};

export { compressImage };