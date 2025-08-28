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

        // 3. Define the rounded rectangle shape for the mask using SVG.
        const cornerRadius = Math.round(iconSize * 0.2237);
        const svgMask = `
          <svg viewBox="0 0 ${iconSize} ${iconSize}" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="${iconSize}" height="${iconSize}" rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
          </svg>
        `;

        // 4. Create a PNG buffer from the SVG mask.
        const maskBuffer = await sharp(Buffer.from(svgMask))
          .png()
          .toBuffer();

        // 5. Process the input image: resize, apply the mask, and save as PNG.
        let image = sharp(input_path)
          .resize(iconSize, iconSize, {
            fit: 'cover',
            position: 'center'
          });

        // If a background color is provided, composite the image over a colored background.
        if (background_color) {
          image = sharp({
            create: {
              width: iconSize,
              height: iconSize,
              channels: 4,
              background: background_color
            }
          })
          .composite([
            {
              input: await image.toBuffer(),
              blend: 'over'
            }
          ]);
        }

        await image.composite([
            {
              input: maskBuffer,
              blend: 'dest-in' // Use 'dest-in' to keep only the parts of the image covered by the mask.
            }
          ])
          .png({
            quality: 100,
            compressionLevel: 9
          })
          .toFile(outputPath);

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