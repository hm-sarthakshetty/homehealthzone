import topics from '../data/clinical-topics.json';

/** Explicit editorial assignments: every article belongs to exactly one topic. */
export function groupClinicalArticles<T extends { id: string; data: { title: string } }>(articles: T[]) {
  const byId = new Map(articles.map((article) => [article.id, article]));
  const assigned = new Set<string>();
  const groups = topics.map((topic) => ({
    ...topic,
    articles: topic.articles.map((id) => {
      const article = byId.get(id);
      if (!article) throw new Error(`Clinical topic "${topic.id}" references missing article "${id}".`);
      if (assigned.has(id)) throw new Error(`Clinical article "${id}" has more than one topic.`);
      assigned.add(id);
      return article;
    }).sort((a, b) => a.data.title.localeCompare(b.data.title, 'en')),
  }));
  const missing = articles.filter((article) => !assigned.has(article.id));
  if (missing.length) throw new Error(`Assign clinical topics for: ${missing.map((article) => article.id).join(', ')}`);
  return groups;
}
