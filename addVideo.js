const fs = require("fs");
const axios = require("axios");
const { exec } = require("child_process");
const readline = require("readline");

// --- HELPER FUNCTIONS ---
function getVideoId(input) {
  if (input.includes("youtube.com") || input.includes("youtu.be")) {
    const match = input.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    return match ? match[1] : null;
  }
  return input;
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [
    h > 0 ? String(h) : null,
    String(m).padStart(2, "0"),
    String(s).padStart(2, "0"),
  ].filter(Boolean).join(":");
}

function extractIdFromLink(link) {
  const match = link.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
  return match ? match[1] : null;
}

function loadDatabase() {
  if (fs.existsSync("data.json")) return JSON.parse(fs.readFileSync("data.json", "utf-8"));
  return { items: [] };
}

function saveDatabase(db) {
  fs.writeFileSync("data.json", JSON.stringify(db, null, 2));
}

async function getVideoData(videoId) {
  return new Promise((resolve, reject) => {
    exec(`yt-dlp -j https://www.youtube.com/watch?v=${videoId}`, (err, stdout) => {
      if (err) return reject("❌ Failed to fetch video data");
      const data = JSON.parse(stdout);
      resolve({
        title: data.title,
        creator: data.uploader,
        duration: formatDuration(data.duration),
        thumbnail: data.thumbnail,
      });
    });
  });
}

async function downloadImage(url, path) {
  const response = await axios({ url, method: "GET", responseType: "stream" });
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(path);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

// --- READLINE INTERFACE ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

// --- ADD VIDEO ---
async function addVideo(db) {
  const input = await ask("Enter YouTube URL or ID: ");
  const videoId = getVideoId(input);
  if (!videoId) {
    console.log("❌ Invalid YouTube link/ID");
    return;
  }

  // Duplicate check
  if (db.items.find(item => extractIdFromLink(item.link) === videoId)) {
    console.log("❌ Video already exists in database!");
    return;
  }

  const data = await getVideoData(videoId);

  if (!fs.existsSync("images")) fs.mkdirSync("images");

  const id = Math.max(0, ...db.items.map(item => item.id)) + 1;
  const imagePath = `images/${id}.jpg`;
  await downloadImage(data.thumbnail, imagePath);

  console.log("\n--- Extracted Video Data ---");
  console.log(`ID: ${id}`);
  console.log(`Title: ${data.title}`);
  console.log(`Creator: ${data.creator}`);
  console.log(`Length: ${data.duration}`);
  console.log(`Thumbnail: ${imagePath}`);
  console.log(`Link: https://www.youtube.com/watch?v=${videoId}`);
  console.log("-----------------------------\n");

  let tags = [];
  const addTagsAnswer = await ask("Do you want to add tags? (y/n): ");
  if (addTagsAnswer.toLowerCase() === "y") {
    const tagsInput = await ask("Enter tags separated by commas: ");
    tags = tagsInput.split(",").map(t => t.trim()).filter(t => t.length > 0);
  }

  const result = {
    id: id,
    title: data.title,
    image: imagePath,
    link: `https://www.youtube.com/watch?v=${videoId}`,
    tags: tags,
    creator: data.creator,
    length: data.duration,
  };

  db.items.push(result);
  saveDatabase(db);

  console.log("\n✅ Video added successfully!");
  console.log("Stored Data:", result);
}

// --- REMOVE VIDEO ---
async function removeVideo(db) {
  if (db.items.length === 0) {
    console.log("\nDatabase is empty!");
    return;
  }

  console.log("\nVideos in Database:");
  db.items.forEach(item => {
    console.log(`${item.id}) ${item.title}`);
  });

  const choice = await ask("Enter the ID of the video to remove: ");
  const idToRemove = parseInt(choice);
  const index = db.items.findIndex(item => item.id === idToRemove);

  if (index !== -1) {
    const imgPath = db.items[index].image;
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);

    // Remove the video
    db.items.splice(index, 1);

    // Re-index IDs sequentially and rename thumbnails
    db.items.forEach((item, i) => {
      const oldPath = item.image;
      item.id = i + 1;
      const newPath = `images/${item.id}.jpg`;
      if (fs.existsSync(oldPath) && oldPath !== newPath) {
        fs.renameSync(oldPath, newPath);
        item.image = newPath;
      }
    });

    saveDatabase(db);
    console.log("✅ Video removed and IDs re-indexed!");
  } else {
    console.log("❌ Invalid ID.");
  }
}

// --- VIEW DATABASE ---
function viewDatabase(db) {
  if (db.items.length === 0) {
    console.log("\nDatabase is empty!");
    return;
  }

  console.log("\n--- DATABASE START ---\n");
  db.items.forEach(item => {
    console.log(`ID: ${item.id}`);
    console.log(`Title: ${item.title}`);
    console.log(`Link: ${item.link}`);
    console.log(`Creator: ${item.creator}`);
    console.log(`Length: ${item.length}`);
    console.log(`Thumbnail: ${item.image}`);
    console.log(`Tags: ${item.tags.join(", ") || "None"}`);
    console.log("\n--------------------\n");
  });
  console.log("--- DATABASE END ---\n");
}

// --- MAIN SINGLE-RUN ---
(async () => {
  const db = loadDatabase();

  console.log("\n--- YouTube Database Manager ---");
  console.log("1) Add Video");
  console.log("2) Remove Video");
  console.log("3) View Database");

  const choice = await ask("\nEnter your choice: ");

  if (choice === "1") {
    await addVideo(db);
  } else if (choice === "2") {
    await removeVideo(db);
  } else if (choice === "3") {
    viewDatabase(db);
  } else {
    console.log("❌ Invalid choice.");
  }

  console.log("\nAction completed. Exiting...");
  rl.close();
})();