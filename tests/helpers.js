const fs = require('fs');
const path = require('path');

const doubanCode = fs.readFileSync(path.join(__dirname, '../js/douban.js'), 'utf8');

function loadDoubanModule() {
  const scriptEl = document.createElement('script');
  scriptEl.textContent = doubanCode;
  document.head.appendChild(scriptEl);
}

function setupDOM() {
  document.body.innerHTML = `
    <div id="doubanArea">
      <div id="douban-results"></div>
      <div id="douban-scroll-sentinel">
        <div id="douban-loading-more" class="hidden"></div>
        <div id="douban-no-more" class="hidden"></div>
      </div>
    </div>
    <div id="douban-tags"></div>
    <button id="douban-movie-toggle"></button>
    <button id="douban-tv-toggle"></button>
    <div id="resultsArea" class="hidden"></div>
  `;
}

function mockSubjects(count, offset = 0) {
  const subjects = [];
  for (let i = 0; i < count; i++) {
    subjects.push({
      id: offset + i + 1,
      title: `Movie ${offset + i + 1}`,
      rate: '8.0',
      cover: `https://example.com/cover${offset + i + 1}.jpg`,
      url: `https://movie.douban.com/subject/${offset + i + 1}`,
    });
  }
  return subjects;
}

module.exports = { loadDoubanModule, setupDOM, mockSubjects };
