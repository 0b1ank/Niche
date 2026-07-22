const { client } = require("../config/db");

const W = { content: 0.4, collab: 0.35, personal: 0.25 }; //how much each score would weigh in the score
//the content itself, how many other people like it, and matches your taste
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "near",
  "a",
  "an",
  "of",
  "in",
  "to",
  "on",
]);

//To check the overlap tags between two lists/cafes
//The more tags they have in common, the higher the score
//The score goes from 0 (nothing in common) to 1(identical)
//The formula is intersection/union
function jaccard(listA, listB) {
  const a = new Set(listA);
  const b = new Set(listB);
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

//this helps the jaccard function read each tag by turning the description to useful words
//Lowercases, removes uncessary words, and split on punctuation
function tokens(text) {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

//makes sure that the ratio between scores and people are balanced
//if there is only one review of 4.5, it doesn't do better than a 4.3 rating with 100 reviews
function popularityScore(avgRating, reviewCount) {
  return (Number(avgRating) || 0) * Math.log10((Number(reviewCount) || 0) + 1);
}

//groups each of the cafe's by their average rating, how many reviews, and the tags
async function loadCafesWithMeta() {
  const cafes = await client.query(`
    SELECT c.*,
           COALESCE(AVG(p.rating), 0) AS avg_rating,
           COUNT(p.pid)::int AS review_count
    FROM cafes c
    LEFT JOIN posts p ON p.cafe_id = c.cid
    GROUP BY c.cid
  `);

  const tagRows = await client.query(`
    SELECT ct.cafe_id, t.tname
    FROM cafe_tags ct
    JOIN tags t ON t.tid = ct.tag_id
  `);

  const tagsByCafe = {};
  for (const row of tagRows.rows) {
    // start a new list the first time we see this cafe
    if (!tagsByCafe[row.cafe_id]) tagsByCafe[row.cafe_id] = [];
    tagsByCafe[row.cafe_id].push(row.tname);
  }

  return cafes.rows.map((c) => ({
    ...c,
    tags: tagsByCafe[c.cid] || [],
    avg_rating: Number(c.avg_rating),
    review_count: Number(c.review_count),
  }));
}

//builds a picture of what this user likes based on their ratings and favorites
//returns null if nobody is logged in
async function loadUserProfile(userId) {
  if (!userId) return null;

  const rated = await client.query(
    `SELECT cafe_id, rating FROM posts WHERE user_id = $1`,
    [userId]
  );
  const favs = await client.query(
    `SELECT cafe_id FROM favorites WHERE user_id = $1`,
    [userId]
  );

  // cities they rated highly (4 or 5 stars)
  const cities = await client.query(
    `SELECT c.ccity, COUNT(*)::int AS n
     FROM posts p
     JOIN cafes c ON c.cid = p.cafe_id
     WHERE p.user_id = $1 AND p.rating >= 4
     GROUP BY c.ccity`,
    [userId]
  );

  // tags from cafes they rated highly OR favorited
  const tags = await client.query(
    `SELECT t.tname, COUNT(*)::int AS n
     FROM (
       SELECT cafe_id FROM posts WHERE user_id = $1 AND rating >= 4
       UNION
       SELECT cafe_id FROM favorites WHERE user_id = $1
     ) liked
     JOIN cafe_tags ct ON ct.cafe_id = liked.cafe_id
     JOIN tags t ON t.tid = ct.tag_id
     GROUP BY t.tname`,
    [userId]
  );

  return {
    ratedCafeIds: new Set(rated.rows.map((r) => r.cafe_id)),
    favoritedCafeIds: new Set(favs.rows.map((r) => r.cafe_id)),
    cities: Object.fromEntries(cities.rows.map((r) => [r.ccity, r.n])),
    tags: tags.rows.map((r) => r.tname),
    topRatedCafeIds: rated.rows
      .filter((r) => r.rating >= 4)
      .map((r) => r.cafe_id),
  };
}

//how similar two cafes are based on city, zip, tags, and description
//reference can be another cafe, or a fake "ideal" cafe built from the user's taste
function contentScore(candidate, reference) {
  const city =
    candidate.ccity && candidate.ccity === reference.ccity ? 1 : 0;
  const zip =
    candidate.czip &&
    reference.czip &&
    candidate.czip.slice(0, 3) === reference.czip.slice(0, 3)
      ? 1
      : 0;
  const tag = jaccard(candidate.tags || [], reference.tags || []);
  const desc = jaccard(
    tokens(candidate.cdescription),
    tokens(reference.cdescription || reference.queryText || "")
  );
  return 0.45 * city + 0.15 * zip + 0.3 * tag + 0.1 * desc;
}

//finds cafes that fans of targetCafeId also rated highly
//returns a map of cafe_id -> 0 to 1 score (1 = most co-liked)
//if there aren't enough shared fans, returns {} so we fall back to content
async function loadCollabMap(targetCafeId) {
  const result = await client.query(
    `WITH fans AS (
       SELECT user_id FROM posts
       WHERE cafe_id = $1 AND rating >= 4
     )
     SELECT p.cafe_id, COUNT(*)::int AS shared_fans
     FROM posts p
     JOIN fans f ON f.user_id = p.user_id
     WHERE p.rating >= 4 AND p.cafe_id <> $1
     GROUP BY p.cafe_id`,
    [targetCafeId]
  );

  const map = {};
  let max = 0;
  for (const row of result.rows) {
    map[row.cafe_id] = row.shared_fans;
    if (row.shared_fans > max) max = row.shared_fans;
  }

  // not enough overlap to trust collaborative filtering
  if (max < 2) return {};

  // normalize so the top co-liked cafe gets 1.0
  for (const id of Object.keys(map)) {
    map[id] = map[id] / max;
  }
  return map;
}

//how well this cafe matches what the user already likes
//guests get 0 here and we use popularity instead in finalScore
function personalScore(candidate, profile) {
  if (!profile) return 0;

  const cityCounts = Object.values(profile.cities);
  const maxCity = cityCounts.length ? Math.max(...cityCounts) : 0;
  const cityPart =
    maxCity && profile.cities[candidate.ccity]
      ? profile.cities[candidate.ccity] / maxCity
      : 0;
  const tagPart = jaccard(candidate.tags || [], profile.tags || []);

  let score = 0.5 * cityPart + 0.5 * tagPart;
  // bury cafes they already rated so "recommended" feels fresh
  if (profile.ratedCafeIds.has(candidate.cid)) score *= 0.2;
  return score;
}

//mixes the three signals into one number we can sort by
//guests don't have personal history so we lean on content + popularity
function finalScore({ content, collab, personal, popularity, isGuest }) {
  if (isGuest) {
    const popNorm = Math.min(popularity / 5, 1);
    return 0.7 * content + 0.3 * popNorm;
  }
  return W.content * content + W.collab * collab + W.personal * personal;
}

//Airbnb-style: when you're looking at one cafe, list other similar ones
async function similarToCafe(cafeId, { userId = null, limit = 6 } = {}) {
  const all = await loadCafesWithMeta();
  const target = all.find((c) => c.cid === Number(cafeId));
  if (!target) return [];

  const profile = await loadUserProfile(userId);
  const collabMap = await loadCollabMap(target.cid);
  const isGuest = !userId;

  return all
    .filter((c) => c.cid !== target.cid)
    .map((c) => {
      const content = contentScore(c, target);
      const collab = collabMap[c.cid] || 0;
      const personal = personalScore(c, profile);
      const popularity = popularityScore(c.avg_rating, c.review_count);
      const score = finalScore({
        content,
        collab,
        personal,
        popularity,
        isGuest,
      });
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

//ranks cafes for the home page / search based on the logged in user's taste
//if nobody is logged in (or they have no high ratings yet), fall back to popularity
async function rankForUser(
  userId,
  { city = null, query = null, limit = 24 } = {}
) {
  let all = await loadCafesWithMeta();
  if (city) {
    all = all.filter((c) => c.ccity === city);
  }

  const profile = await loadUserProfile(userId);
  const isGuest =
    !userId || !profile || profile.topRatedCafeIds.length === 0;

  // fake "ideal cafe" built from what they like + optional search text
  const reference = {
    ccity: city || (profile && Object.keys(profile.cities)[0]) || null,
    czip: null,
    tags: profile ? profile.tags : [],
    cdescription: query || "",
    queryText: query || "",
  };

  // use their highest rated cafe as the seed for "people who liked X also liked Y"
  let collabMap = {};
  if (profile && profile.topRatedCafeIds[0]) {
    collabMap = await loadCollabMap(profile.topRatedCafeIds[0]);
  }

  return all
    .map((c) => {
      let content = contentScore(c, reference);

      // bump cafes whose name or tags match the search box
      if (query) {
        const q = query.toLowerCase();
        const nameHit = (c.cname || "").toLowerCase().includes(q) ? 0.2 : 0;
        const tagHit = (c.tags || []).some((t) => t.includes(q)) ? 0.15 : 0;
        content = Math.min(1, content + nameHit + tagHit);
      }

      const collab = collabMap[c.cid] || 0;
      const personal = personalScore(c, profile);
      const popularity = popularityScore(c.avg_rating, c.review_count);
      const score = finalScore({
        content: isGuest ? Math.max(content, 0.3) : content,
        collab,
        personal,
        popularity,
        isGuest,
      });
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { similarToCafe, rankForUser };
