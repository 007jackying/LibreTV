function generateMockSubjects(count, startId = 0) {
  return Array.from({ length: count }, (_, i) => ({
    title: `Test Movie ${startId + i + 1}`,
    rate: (7 + Math.random() * 3).toFixed(1),
    cover: `https://img.doubanio.com/view/photo/s_ratio/poster/public/p${startId + i}.jpg`,
    url: `https://movie.douban.com/subject/${startId + i + 10000000}/`,
    id: startId + i,
  }));
}

const mockResponses = {
  success50: { subjects: generateMockSubjects(50, 0) },
  success50SecondBatch: { subjects: generateMockSubjects(50, 50) },
  success50ThirdBatch: { subjects: generateMockSubjects(50, 100) },
  success20: { subjects: generateMockSubjects(20, 0) },
  empty: { subjects: [] },
  error: null,
};

module.exports = { mockResponses, generateMockSubjects };
