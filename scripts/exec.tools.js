const fs = require('fs');
const paths = require("../config/paths");
const path = require("path");

const filePath = path.join(paths.toolsBuild, "main.js");

(async () => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("No build found ❌");
    }
    console.log(`Running ... ▶️`);
    require(filePath);
    console.log("Done running ✅");
  } catch (err) {
    if (err && err.message) {
      console.log(err.message);
    }
    process.exit(1);
  }
})();
