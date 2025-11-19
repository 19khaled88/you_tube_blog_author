import sharp from "sharp";

// Image compression function
const compressImage = async (imageBuffer: Buffer, maxSizeMB: number = 2): Promise<Buffer> => {
  let compressedBuffer = imageBuffer;
  
  // Only compress if image is larger than maxSizeMB
  if (imageBuffer.length > maxSizeMB * 1024 * 1024) {
    console.log(`Compressing image from ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB`);
    
    let quality = 80;
    let width = 1200;

    // First compression attempt
    compressedBuffer = await sharp(imageBuffer)
      .resize(width, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ 
        quality: quality,
        mozjpeg: true 
      })
      .toBuffer();

    // If still too large, reduce further
    if (compressedBuffer.length > maxSizeMB * 1024 * 1024) {
      quality = 60;
      width = 800;
      
      compressedBuffer = await sharp(imageBuffer)
        .resize(width, null, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: quality })
        .toBuffer();
    }

    console.log(`Compressed to ${(compressedBuffer.length / 1024 / 1024).toFixed(2)}MB`);
  }
  
  return compressedBuffer;
};

export { compressImage };