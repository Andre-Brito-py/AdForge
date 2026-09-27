const { Jimp } = require("jimp");

async function removeWhiteBg() {
  try {
    const image = await Jimp.read("public/logo-full.png");
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      // Threshold for white
      if (r > 230 && g > 230 && b > 230) {
        this.bitmap.data[idx + 3] = 0; // set alpha to 0
      }
    });
    image.write("public/logo-full.png");
    image.write("public/logo-icon.png");
    console.log("White background removed successfully!");
  } catch (err) {
    console.error("Error processing image:", err);
  }
}

removeWhiteBg();
