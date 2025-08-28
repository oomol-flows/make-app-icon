import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

//#region generated meta
type Inputs = {
  input_path: string;
  output_dir: string;
  size: "1024" | "512" | "256" | "128" | "all";
  background_color: string | null;
};
type Outputs = {
  success: boolean;
  output_dir: string;
};
//#endregion

/**
 * Generates an Apple-style rounded rectangle app icon from an input image.
 * This task takes an image, resizes it, and applies a mask to create the
 * characteristic rounded corners of an iOS app icon.
 *
 * @param params The input parameters for the task.
 * @returns A promise that resolves with the output of the task.
 */
export default async function(params: Inputs): Promise<Outputs> {
  const { input_path, output_dir, size = "all", background_color = "#FFF" } = params;

  if (!input_path || !output_dir) {
    throw new Error("Input path and output dir must be provided.");
  }

  const sizesToGenerate = (size === 'all' ? [1024, 512, 256, 128] : [parseInt(size, 10)]);

  for (const s of sizesToGenerate) {
      if (s <= 0) {
          throw new Error("Size must be a positive number.");
      }
  }

  try {
    // 1. Verify the input file is accessible before proceeding.
    await fs.access(input_path);

    // 2. Ensure the directory for the output file exists.
    await fs.mkdir(output_dir, { recursive: true });

    for (const iconSize of sizesToGenerate) {
        const inputFilename = path.basename(input_path, path.extname(input_path));
        const outputFilename = `${inputFilename}-${iconSize}.png`;
        const outputPath = path.join(output_dir, outputFilename);

        // 3. Process and resize the input image first
        const resizedImageBuffer = await sharp(input_path)
          .resize(iconSize, iconSize, {
            fit: 'cover',
            position: 'center'
          })
          .png()
          .toBuffer();

        // 4. Create alpha mask for rounded corners 
        const cornerRadius = Math.round(iconSize * 0.2237);
        
        // Create alpha mask - transparent background, opaque rounded rectangle
        const alphaMask = await sharp({
          create: {
            width: iconSize,
            height: iconSize,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }  // Transparent background
          }
        })
        .composite([{
          input: Buffer.from(`<svg width="${iconSize}" height="${iconSize}">
            <rect width="${iconSize}" height="${iconSize}" rx="${cornerRadius}" fill="white" fill-opacity="1"/>
          </svg>`),
          blend: 'over'
        }])
        .png()
        .toBuffer();

        // 5. Apply mask to the resized image to create rounded corners
        const maskedImageBuffer = await sharp(resizedImageBuffer)
          .composite([{
            input: alphaMask,
            blend: 'dest-in'
          }])
          .png()
          .toBuffer();

        // 6. Create final result
        if (background_color) {
          // Create background and place masked image on top
          await sharp({
            create: {
              width: iconSize,
              height: iconSize,
              channels: 4,
              background: background_color
            }
          })
          .composite([{
            input: maskedImageBuffer,
            blend: 'over'
          }])
          .png({
            quality: 100,
            compressionLevel: 9
          })
          .toFile(outputPath);
        } else {
          // Just use the masked image
          await sharp(maskedImageBuffer)
          .png({
            quality: 100,
            compressionLevel: 9
          })
          .toFile(outputPath);
        }

        console.log(`✅ App icon created successfully: ${outputPath}`);
    }


    // 6. Return the result.
    return {
      success: true,
      output_dir: output_dir
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to create app icon: ${errorMessage}`);
    // Re-throw a new error to ensure the task fails with a clear message.
    throw new Error(`Operation failed: ${errorMessage}`);
  }
}