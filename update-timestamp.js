const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'FrameDataTable.tsx');
const placeholder = 'Website last deployed'; // Make sure this exactly matches the text in the component
const timestamp = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
}); // Example: "April 30, 2024, 02:30 PM PST" - Adjust format as needed

try {
    let content = fs.readFileSync(filePath, 'utf8');

    if (content.includes(placeholder)) {
        content = content.replace(placeholder, `Website last deployed: ${timestamp}`);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated timestamp in ${filePath}`);
    } else {
        console.warn(`Placeholder "${placeholder}" not found in ${filePath}. Skipping update.`);
    }
} catch (error) {
    console.error(`Error updating timestamp in ${filePath}:`, error);
    process.exit(1); // Exit with error code if update fails
} 