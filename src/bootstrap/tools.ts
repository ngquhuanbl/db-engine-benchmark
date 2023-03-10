// import path from "path";
// import fs from "fs";
// import JsonStreamStringify from "json-stream-stringify";

// import { generateData } from "../helpers/shared/generate-data";

// const arg = process.argv[2];
// const size = arg !== undefined ? +process.argv[2] : 10;

// const data = generateData(size);
// const jsonStream = new JsonStreamStringify(data);

// const filePath = path.join(process.cwd(), "src", "data.json");
// const writeStream = fs.createWriteStream(filePath, { flags: "w" });

// jsonStream.pipe(writeStream);
