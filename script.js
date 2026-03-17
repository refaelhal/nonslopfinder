// Elements
const image = document.getElementById("image");
const title = document.getElementById("title");
const creatorEl = document.getElementById("creator");
const tagsEl = document.getElementById("tags");
const lengthEl = document.getElementById("length");
const randomBtn = document.getElementById("randomBtn");
const searchInput = document.getElementById("searchInput");
const suggestionsList = document.getElementById("suggestions");
const card = document.querySelector(".card");

// Current video item
let currentItem = null;

// Track used IDs to avoid repeats
const usedIds = new Set();

// Store all videos
let itemsData = [];

// Load data.json
fetch("data.json")
    .then(res => res.json())
    .then(data => {
        if (!data.items || !Array.isArray(data.items)) {
            throw new Error("Invalid JSON format: 'items' array missing");
        }
        itemsData = data.items;

        // Show a random video on page load
        getRandomItem();
        animateCardUpdate(currentItem);
    })
    .catch(err => {
        console.error("Failed to load data.json:", err);
        title.textContent = "Error loading videos";
        creatorEl.textContent = "";
        tagsEl.textContent = "";
        lengthEl.textContent = "";
        image.src = "";
    });

// Open video in new tab
function openVideo() {
    if (currentItem && currentItem.link) {
        window.open(currentItem.link, "_blank");
    }
}

image.addEventListener("click", openVideo);
title.addEventListener("click", openVideo);

// Random video button
randomBtn.addEventListener("click", () => {
    getRandomItem();
    animateCardUpdate(currentItem);
});

// Get a random video
function getRandomItem() {
    if (!itemsData.length) return; // Nothing loaded yet

    let availableItems = itemsData.filter(item => !usedIds.has(item.id));

    if (!availableItems.length) {
        // All used, reset
        usedIds.clear();
        availableItems = [...itemsData];
    }

    const randomIndex = Math.floor(Math.random() * availableItems.length);
    currentItem = availableItems[randomIndex];
    usedIds.add(currentItem.id);
}

// Update video card content
function updateCard(item) {
    image.src = item.image;
    title.textContent = item.title;
    creatorEl.textContent = `Creator: ${item.creator}`;
    tagsEl.textContent = `Tags: ${item.tags.join(", ")}`;
    lengthEl.textContent = item.length ? `Length: ${item.length}` : "";
}

// Animate card fade with minimum duration and wait for image load
function animateCardUpdate(item) {
    const minDuration = 200; // 0.2 seconds
    const startTime = Date.now();

    card.style.opacity = 0; // fade out

    // Preload image
    const img = new Image();
    img.src = item.image;

    img.onload = () => {
        const elapsed = Date.now() - startTime;
        const delay = Math.max(minDuration - elapsed, 0);

        setTimeout(() => {
            updateCard(item); // update content after fade
            card.style.opacity = 1; // fade in
        }, delay);
    };

    img.onerror = () => {
        const elapsed = Date.now() - startTime;
        const delay = Math.max(minDuration - elapsed, 0);

        console.error("Failed to load image:", item.image);
        setTimeout(() => {
            updateCard(item); // still update
            card.style.opacity = 1;
        }, delay);
    };
}

// Search suggestions
function showSuggestions() {
    const query = searchInput.value.toLowerCase().trim();
    const matches = query
        ? itemsData.filter(item =>
            item.title.toLowerCase().includes(query) ||
            item.creator.toLowerCase().includes(query) ||
            item.tags.some(tag => tag.toLowerCase().includes(query))
        )
        : itemsData.slice(0, 5); // first 5 items if empty

    suggestionsList.innerHTML = "";
    matches.forEach(item => {
        const li = document.createElement("li");
        li.textContent = `${item.title} (${item.creator})`;
        li.addEventListener("click", () => selectItem(item));
        suggestionsList.appendChild(li);
    });

    suggestionsList.style.display = matches.length ? "block" : "none";
}

// Input events
searchInput.addEventListener("input", showSuggestions);
searchInput.addEventListener("focus", showSuggestions);

// Select item from suggestions
function selectItem(item) {
    currentItem = item;
    animateCardUpdate(item);
    suggestionsList.style.display = "none";
    searchInput.value = "";
}

// Close suggestions when clicking outside
document.addEventListener("click", (e) => {
    const searchWrapper = document.querySelector(".search-wrapper");
    if (!searchWrapper.contains(e.target)) {
        suggestionsList.style.display = "none";
    }
});

// Prevent closing when clicking suggestions
suggestionsList.addEventListener("click", (e) => e.stopPropagation());