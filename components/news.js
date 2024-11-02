// components/news.js
const Parser = require('rss-parser');
const parser = new Parser();

async function loadNews() {
  try {
    const feed = await parser.parseURL('https://snuggledtogetherblog.wordpress.com/feed/');
    const newsList = document.getElementById('news-list');
    feed.items.forEach(item => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = item.link;
      a.textContent = item.title;
      a.target = '_blank';
      li.appendChild(a);
      newsList.appendChild(li);
    });
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
  }
}

module.exports = loadNews;

