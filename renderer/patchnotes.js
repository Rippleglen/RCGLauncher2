const { shell } = require('electron'); // For opening links in the default browser
const Parser = require('rss-parser'); // RSS parser library
const parser = new Parser();

async function loadPatchNotes() {
  updatePatchHeader();
  const modpackName = window.currentlySelectedModpackName; // Get selected modpack name
  const modpacksData = await fetchModpacksJSON(); // Load modpacks.json data
  console.log(modpackName);

  // Find category for the selected modpack
  const modpack = modpacksData.find(pack => pack.name === modpackName);
  console.log(modpack);
  if (!modpack || !modpack.patchCategory) {
    console.error('Patch category not found for selected modpack.');
    return;
  }

  const category = modpack.patchCategory; // Get the patch category
  const feedUrl = 'https://snuggledtogetherblog.wordpress.com/feed/'; // Replace with dynamic URL if needed

  try {
    // Fetch the RSS feed as raw XML
    const response = await fetch(feedUrl);
    const xmlData = await response.text();

    // Parse the feed with rss-parser
    const feed = await parser.parseString(xmlData);
    const filteredItems = feed.items.filter(item => item.categories.includes(category));

    const gridContainer = document.getElementById('patchnotes-grid');
    if (gridContainer) {
      gridContainer.innerHTML = ''; // Clear previous entries

      filteredItems.forEach(item => {
        const noteElement = document.createElement('div');
        noteElement.className = 'grid-item';
      
        // Extract the thumbnail URL using the existing logic
        const itemStart = xmlData.indexOf(`<title>${item.title}</title>`);
        const itemEnd = xmlData.indexOf('</item>', itemStart);
        const itemXml = xmlData.substring(itemStart, itemEnd);
        const thumbnailMatch = itemXml.match(/<media:thumbnail\s+url="([^"]+)"/);

        const thumbnailUrl = thumbnailMatch ? thumbnailMatch[1] : '../assets/RCGLogofork.png'; // Use default if not found
      
        // Thumbnail
        const thumbnail = document.createElement('img');
        thumbnail.src = thumbnailUrl;
        thumbnail.alt = `${item.title} thumbnail`;
        thumbnail.style.width = '100%';
        thumbnail.style.height = '180px'; // Fixed height for consistent grid cards
        thumbnail.style.objectFit = 'cover';
      
        // Content
        const contentContainer = document.createElement('div');
        contentContainer.className = 'grid-item-content';
      
        const title = document.createElement('h3');
        title.textContent = item.title;
      
        const categoryParagraph = document.createElement('p'); // Use a new variable for the <p> element
        categoryParagraph.textContent = `Category: ${category}`; // Optional: Add category display
      
        contentContainer.appendChild(title);
        contentContainer.appendChild(categoryParagraph); // Append the correct <p> element
      
        noteElement.appendChild(thumbnail);
        noteElement.appendChild(contentContainer);
      
        // OnClick to open link
        noteElement.onclick = () => shell.openExternal(item.link);
      
        gridContainer.appendChild(noteElement);
      });
      
    }
  } catch (error) {
    console.error('Error loading patch notes:', error);
  }
}

async function fetchModpacksJSON() {
  try {
    const timestamp = new Date().getTime(); // Current timestamp
    const response = await fetch(`https://cdn.andreasrp.com/rcg2/jsons/modpacks.json?ts=${timestamp}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching modpacks.json:', error);
    return [];
  }
}

function updatePatchHeader() {
    const header = document.getElementById('patch-header');
    if (header && window.currentlySelectedModpackName) {
        header.textContent = `${window.currentlySelectedModpackName}: Patch Notes`;
        header.style.fontFamily = 'Segoe UI';
        header.style.fontWeight = 'bolder';
        header.style.setProperty('font-size', '16px', 'important');
        header.style.setProperty('color', '#ffffff', 'important');
        console.log(`Updated header: ${header.textContent}`); // Debugging line
    } else {
        console.error('Header or currently selected modpack name not found.');
    }
}
