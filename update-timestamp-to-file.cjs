const fs = require("fs");
const path = require("path");

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, "public");
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

// Generate the timestamp
const timestamp = new Date().toLocaleString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    hour12: false,
});

// Write to timestamp.json
const timestampFile = path.join(publicDir, "timestamp.json");
fs.writeFileSync(timestampFile, JSON.stringify({ timestamp }), "utf8");
console.log(`Updated timestamp in ${timestampFile}`);
