const { Jimp } = require("jimp");
const fs = require("fs");

async function processLogos() {
  try {
    // We need to read the original file we saved from user upload.
    // Wait, we overwrote the original public/logo-full.png with the transparent one.
    // Let's re-read the original from the user uploads folder just to be safe.
    const originalPath = "C:/Users/André/.gemini/antigravity/brain/3b10a952-54b0-4b2e-ae55-d8f6c49c6842/.user_uploaded/media_1790527693768.png";
    
    // Process Light Mode Logo (White BG removed)
    const imgLight = await Jimp.read(originalPath);
    imgLight.scan(0, 0, imgLight.bitmap.width, imgLight.bitmap.height, function (x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      // Remove white BG
      if (r > 240 && g > 240 && b > 240) {
        this.bitmap.data[idx + 3] = 0; 
      }
    });
    await imgLight.write("public/logo-full.png");
    await imgLight.write("public/logo-icon.png");

    // Process Dark Mode Logo (White BG removed, Black -> White)
    const imgDark = await Jimp.read(originalPath);
    imgDark.scan(0, 0, imgDark.bitmap.width, imgDark.bitmap.height, function (x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      // Remove white BG
      if (r > 240 && g > 240 && b > 240) {
        this.bitmap.data[idx + 3] = 0; 
      } 
      // Convert Black/Dark to White
      else if (r < 80 && g < 80 && b < 80) {
        this.bitmap.data[idx + 0] = 255;
        this.bitmap.data[idx + 1] = 255;
        this.bitmap.data[idx + 2] = 255;
        // Keep original alpha
      }
    });
    await imgDark.write("public/logo-dark.png");
    await imgDark.write("public/logo-icon-dark.png");

    console.log("Logos processed successfully!");
  } catch (err) {
    console.error("Error:", err);
  }
}

processLogos();
