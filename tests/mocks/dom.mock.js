function createDoubanDOMFixture() {
  const wrapper = document.createElement('div');
  wrapper.id = 'douban-fixture';
  wrapper.innerHTML = `
    <div id="doubanArea">
      <div id="douban-tags"></div>
      <div id="douban-results" class="grid"></div>
      <div id="douban-scroll-sentinel"></div>
      <div id="douban-loading-more" class="hidden"></div>
      <div id="douban-no-more" class="hidden"></div>
      <div id="douban-movie-toggle"></div>
      <div id="douban-tv-toggle"></div>
      <div id="doubanToggle"></div>
      <div id="doubanDataProxySelect"></div>
      <div id="doubanImageProxySelect"></div>
    </div>
  `;
  document.body.appendChild(wrapper);
  return wrapper;
}

function cleanupDoubanDOMFixture() {
  const existing = document.getElementById('douban-fixture');
  if (existing) existing.remove();
}

module.exports = { createDoubanDOMFixture, cleanupDoubanDOMFixture };
