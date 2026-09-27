const axios = require('axios');

const NEWS = 'https://news.google.com/rss/search?q=';
const makeFeedUrl = query => `${NEWS}${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
const FEEDS = [
  { key: 'automation', label: 'Industrial automation', query: 'industrial automation PLC SCADA manufacturing', color: 'blue' },
  { key: 'it', label: 'IT & software', query: 'information technology software cloud cybersecurity India', color: 'indigo' },
  { key: 'digital-marketing', label: 'Digital marketing', query: 'digital marketing SEO ecommerce India', color: 'pink' },
  { key: 'bms-cctv', label: 'BMS & CCTV', query: 'building management systems CCTV security smart buildings', color: 'teal' },
  { key: 'embedded-iot', label: 'Embedded & IoT', query: 'embedded systems Internet of Things IoT engineering', color: 'green' },
  { key: 'careers', label: 'Careers & companies', query: 'India careers hiring companies workplace jobs', color: 'orange' },
  { key: 'workplace', label: 'Workplace & policy', query: 'India labour employment jobs government rules notifications', color: 'red' },
  { key: 'interviews', label: 'Interview preparation', query: 'technical interview preparation hiring India', color: 'violet' },
  { key: 'salary-resumes', label: 'Salary & resumes', query: 'India salary trends resume CV job search', color: 'amber' }
];

let cachedFeed = null;
let cachedAt = 0;
const CACHE_MS = 10 * 60 * 1000;

const decodeXml = value => String(value || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'");

const plainText = value => decodeXml(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const tagValue = (xml, tag) => {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1] : '';
};

function parseFeed(xml, feed) {
  const entries = [...String(xml || '').matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)];
  return entries.map(([, type, item]) => {
    const title = plainText(tagValue(item, 'title'));
    const summary = plainText(tagValue(item, type.toLowerCase() === 'entry' ? 'summary' : 'description'));
    let link = plainText(tagValue(item, 'link'));
    if (!link) link = item.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] || '';
    let source = plainText(tagValue(item, 'source'));
    if (!source && link) {
      try { source = new URL(link).hostname.replace(/^www\./, ''); } catch { source = ''; }
    }
    const rawDate = plainText(tagValue(item, 'pubDate') || tagValue(item, 'published') || tagValue(item, 'updated'));
    const publishedAt = rawDate && !Number.isNaN(Date.parse(rawDate)) ? new Date(rawDate).toISOString() : '';
    if (!title || !/^https?:\/\//i.test(link)) return null;
    return { id: `${feed.key}:${link}`, category: feed.key, categoryLabel: feed.label, color: feed.color, title, summary: summary.slice(0, 320), link, source, publishedAt };
  }).filter(Boolean);
}

exports.getCareerFeed = async (req, res) => {
  try {
    if (cachedFeed && Date.now() - cachedAt < CACHE_MS) {
      return res.json({ success: true, refreshedAt: new Date(cachedAt).toISOString(), categories: FEEDS, items: cachedFeed });
    }

    const results = await Promise.allSettled(FEEDS.map(async feed => {
      const response = await axios.get(makeFeedUrl(feed.query), {
        timeout: 8000,
        responseType: 'text',
        headers: { 'User-Agent': 'IPCS-Staff-CareerHub/1.0' },
        maxContentLength: 2 * 1024 * 1024
      });
      return parseFeed(response.data, feed).slice(0, 8);
    }));

    const items = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    const unique = [...new Map(items.map(item => [item.link, item])).values()]
      .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
    if (!unique.length && cachedFeed) {
      return res.json({ success: true, stale: true, refreshedAt: new Date(cachedAt).toISOString(), categories: FEEDS, items: cachedFeed });
    }
    cachedFeed = unique;
    cachedAt = Date.now();
    res.json({ success: true, refreshedAt: new Date(cachedAt).toISOString(), categories: FEEDS, items: unique });
  } catch (error) {
    if (cachedFeed) return res.json({ success: true, stale: true, refreshedAt: new Date(cachedAt).toISOString(), categories: FEEDS, items: cachedFeed });
    res.status(502).json({ success: false, message: 'The industry feed is temporarily unavailable. Please try again shortly.' });
  }
};
