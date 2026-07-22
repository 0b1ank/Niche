// fills the database with sample users, cafes, and reviews
// run with: node db/seed.js
require("dotenv").config()
const bcrypt = require("bcrypt")
const { Client } = require("pg")

const DEFAULT_PASSWORD = "password123"

const SEED_USERS = [
  { uname: "arcade_owner", uemail: "arcade@cafeseed.test", urole: "owner" },
  { uname: "la_roaster", uemail: "la.roaster@cafeseed.test", urole: "owner" },
  { uname: "ie_coffee", uemail: "ie.coffee@cafeseed.test", urole: "owner" },
  { uname: "oc_barista", uemail: "oc.barista@cafeseed.test", urole: "owner" },
  { uname: "maya_reviews", uemail: "maya@cafeseed.test", urole: "user" },
  { uname: "jordan_sips", uemail: "jordan@cafeseed.test", urole: "user" },
  { uname: "sam_latte", uemail: "sam@cafeseed.test", urole: "user" },
]

const CAFE_IMAGES = [
  "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800",
  "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800",
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800",
  "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800",
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800",
  "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800",
  "https://images.unsplash.com/photo-1453614512568-c4024d13c337?w=800",
  "https://images.unsplash.com/photo-1498804103079-a6351b050096?w=800",
  "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800",
  "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800",
]

// ownerKey points to which seed user owns this cafe (0-3 are owners)
const CAFES = [
  // Riverside / Inland Empire
  {
    ownerKey: 0,
    cname: "The Arcade Coffee Roasters",
    caddress: "3591 University Ave",
    ccity: "Riverside",
    czip: "92501",
    cphonenum: "951-555-0101",
    cdescription:
      "A trendy warehouse space in Riverside serving exceptional specialty coffee near downtown.",
  },
  {
    ownerKey: 0,
    cname: "Condron Coffee",
    caddress: "5225 Canyon Crest Dr",
    ccity: "Riverside",
    czip: "92507",
    cphonenum: "951-555-0102",
    cdescription:
      "Sleek, minimalist, and quiet — a study-friendly cafe near UCR with pour-overs and house pastries.",
  },
  {
    ownerKey: 2,
    cname: "Back to the Grind",
    caddress: "3575 University Ave",
    ccity: "Riverside",
    czip: "92501",
    cphonenum: "951-555-0103",
    cdescription:
      "Longtime downtown Riverside favorite with live music nights and a full espresso bar.",
  },
  {
    ownerKey: 2,
    cname: "Brew Coffee Bar",
    caddress: "3649 Main St",
    ccity: "Riverside",
    czip: "92501",
    cphonenum: "951-555-0104",
    cdescription:
      "Compact Main Street coffee bar known for flat whites and seasonal syrups.",
  },
  {
    ownerKey: 2,
    cname: "Simple & Sweet",
    caddress: "3737 Main St",
    ccity: "Riverside",
    czip: "92501",
    cphonenum: "951-555-0105",
    cdescription:
      "Cozy dessert cafe with strong espresso and homemade cakes.",
  },
  {
    ownerKey: 2,
    cname: "Coffee Bean & Leaf Riverside",
    caddress: "1201 University Ave",
    ccity: "Riverside",
    czip: "92507",
    cphonenum: "951-555-0106",
    cdescription:
      "Reliable campus-area stop for iced teas, cold brew, and laptop sessions.",
  },
  {
    ownerKey: 2,
    cname: "Mission Grove Coffee",
    caddress: "2800 Campus Pkwy",
    ccity: "Riverside",
    czip: "92507",
    cphonenum: "951-555-0107",
    cdescription:
      "Neighborhood cafe near Mission Grove with patio seating and breakfast burritos.",
  },
  {
    ownerKey: 2,
    cname: "Canyon Crest Roasters",
    caddress: "5225 Canyon Crest Dr #18",
    ccity: "Riverside",
    czip: "92507",
    cphonenum: "951-555-0108",
    cdescription:
      "Small-batch roasting and tasting flights in the Canyon Crest plaza.",
  },
  {
    ownerKey: 2,
    cname: "Magnolia Press",
    caddress: "9501 Magnolia Ave",
    ccity: "Riverside",
    czip: "92503",
    cphonenum: "951-555-0109",
    cdescription:
      "West Riverside cafe with nitro cold brew and free Wi-Fi.",
  },
  {
    ownerKey: 2,
    cname: "Hidden Grounds Riverside",
    caddress: "1180 W Blaine St",
    ccity: "Riverside",
    czip: "92507",
    cphonenum: "951-555-0110",
    cdescription:
      "Student hangout near campus with matcha, oat milk lattes, and study nooks.",
  },

  // San Bernardino / Redlands / IE
  {
    ownerKey: 2,
    cname: "Bear & Kono's Coffee Shop",
    caddress: "450 E Hospitality Ln",
    ccity: "San Bernardino",
    czip: "92408",
    cphonenum: "909-555-0201",
    cdescription:
      "Artsy cafe specializing in meticulously sourced beans and Japanese-style pour-overs.",
  },
  {
    ownerKey: 2,
    cname: "Mitaka Coffee",
    caddress: "21 E State St",
    ccity: "Redlands",
    czip: "92373",
    cphonenum: "909-555-0202",
    cdescription:
      "Downtown Redlands specialty spot with outdoor seating and weekend pastry specials.",
  },
  {
    ownerKey: 2,
    cname: "Gourmet Coffee Bar",
    caddress: "350 Orange St",
    ccity: "Redlands",
    czip: "92373",
    cphonenum: "909-555-0203",
    cdescription:
      "Classic Redlands coffeehouse with espresso drinks and local art on the walls.",
  },
  {
    ownerKey: 2,
    cname: "Escape Craft Coffee",
    caddress: "1650 S Waterman Ave",
    ccity: "San Bernardino",
    czip: "92408",
    cphonenum: "909-555-0204",
    cdescription:
      "Craft coffee and light bites near the inland shopping corridor.",
  },
  {
    ownerKey: 2,
    cname: "Coffee Klatch San Bernardino",
    caddress: "222 N Mountain Ave",
    ccity: "San Bernardino",
    czip: "92401",
    cphonenum: "909-555-0205",
    cdescription:
      "Award-winning roastery cafe with single-origin espresso and house blends.",
  },
  {
    ownerKey: 2,
    cname: "Harvest Coffee Bar",
    caddress: "1150 Brookside Ave",
    ccity: "Redlands",
    czip: "92373",
    cphonenum: "909-555-0206",
    cdescription:
      "Bright cafe with farm-to-table snacks and carefully dialed espresso.",
  },
  {
    ownerKey: 2,
    cname: "Uptown Coffee Co",
    caddress: "201 E State St",
    ccity: "Redlands",
    czip: "92373",
    cphonenum: "909-555-0207",
    cdescription:
      "Friendly neighborhood coffee shop popular with remote workers.",
  },
  {
    ownerKey: 2,
    cname: "Inland Espresso Lab",
    caddress: "880 W 4th St",
    ccity: "San Bernardino",
    czip: "92410",
    cphonenum: "909-555-0208",
    cdescription:
      "Experimental espresso drinks and latte art workshops on weekends.",
  },

  // Los Angeles
  {
    ownerKey: 1,
    cname: "Maru Coffee",
    caddress: "500 Traction Ave",
    ccity: "Los Angeles",
    czip: "90013",
    cphonenum: "213-555-0301",
    cdescription:
      "Ultra-minimalist Arts District favorite specializing in meticulously sourced beans.",
  },
  {
    ownerKey: 1,
    cname: "Sightglass Coffee",
    caddress: "845 S Broadway",
    ccity: "Los Angeles",
    czip: "90014",
    cphonenum: "213-555-0302",
    cdescription:
      "Beautiful multi-story inspired cafe with house-roasted beans and airy seating.",
  },
  {
    ownerKey: 1,
    cname: "Intelligentsia Silver Lake",
    caddress: "3922 W Sunset Blvd",
    ccity: "Los Angeles",
    czip: "90029",
    cphonenum: "323-555-0303",
    cdescription:
      "Iconic Silver Lake coffee bar with black aprons and precise pour-overs.",
  },
  {
    ownerKey: 1,
    cname: "Verve Coffee DTLA",
    caddress: "833 S Spring St",
    ccity: "Los Angeles",
    czip: "90014",
    cphonenum: "213-555-0304",
    cdescription:
      "Downtown LA outpost of the Santa Cruz roaster — bright, citrusy espresso.",
  },
  {
    ownerKey: 1,
    cname: "Alfred Coffee Melrose",
    caddress: "8428 Melrose Pl",
    ccity: "Los Angeles",
    czip: "90069",
    cphonenum: "323-555-0305",
    cdescription:
      "Stylish Melrose cafe famous for Instagrammable interiors and solid lattes.",
  },
  {
    ownerKey: 1,
    cname: "Menotti's Coffee Stop",
    caddress: "41 Windward Ave",
    ccity: "Venice",
    czip: "90291",
    cphonenum: "310-555-0306",
    cdescription:
      "Tiny Venice Beach walk-up window with strong espresso and beach vibes.",
  },
  {
    ownerKey: 1,
    cname: "Groundwork Coffee Hollywood",
    caddress: "1501 N Cahuenga Blvd",
    ccity: "Los Angeles",
    czip: "90028",
    cphonenum: "323-555-0307",
    cdescription:
      "Organic Hollywood cafe with patio seating and fair-trade beans.",
  },
  {
    ownerKey: 1,
    cname: "Lamill Coffee Boutique",
    caddress: "1630 Silver Lake Blvd",
    ccity: "Los Angeles",
    czip: "90026",
    cphonenum: "323-555-0308",
    cdescription:
      "Silver Lake coffee boutique with refined espresso and brunch plates.",
  },
  {
    ownerKey: 1,
    cname: "G&B Coffee Grand Central",
    caddress: "317 S Broadway",
    ccity: "Los Angeles",
    czip: "90013",
    cphonenum: "213-555-0309",
    cdescription:
      "Grand Central Market staple — espresso drinks in the heart of DTLA.",
  },
  {
    ownerKey: 1,
    cname: "Stumptown Coffee Arts District",
    caddress: "806 Mateo St",
    ccity: "Los Angeles",
    czip: "90021",
    cphonenum: "213-555-0310",
    cdescription:
      "Portland roaster's Arts District cafe with Hair Bender espresso.",
  },
  {
    ownerKey: 1,
    cname: "Blue Bottle Arts District",
    caddress: "204 S Santa Fe Ave",
    ccity: "Los Angeles",
    czip: "90012",
    cphonenum: "213-555-0311",
    cdescription:
      "Bright, modern cafe with New Orleans iced coffee and pastry cases.",
  },
  {
    ownerKey: 1,
    cname: "Republique Cafe",
    caddress: "461 S La Brea Ave",
    ccity: "Los Angeles",
    czip: "90036",
    cphonenum: "310-555-0312",
    cdescription:
      "Cathedral-like bakery cafe on La Brea with exceptional coffee and croissants.",
  },
  {
    ownerKey: 1,
    cname: "Cafe Dulce Little Tokyo",
    caddress: "134 Japanese Village Plaza",
    ccity: "Los Angeles",
    czip: "90012",
    cphonenum: "213-555-0313",
    cdescription:
      "Little Tokyo cafe known for matcha lattes and mochi doughnuts.",
  },
  {
    ownerKey: 1,
    cname: "Coffee Commissary Burbank",
    caddress: "3200 W Magnolia Blvd",
    ccity: "Burbank",
    czip: "91505",
    cphonenum: "818-555-0314",
    cdescription:
      "Industry hangout near studios with strong drip and avocado toast.",
  },
  {
    ownerKey: 1,
    cname: "Stereoscope Coffee",
    caddress: "2100 N Highland Ave",
    ccity: "Los Angeles",
    czip: "90068",
    cphonenum: "323-555-0315",
    cdescription:
      "Hollywood Hills cafe with canyon views and carefully roasted espresso.",
  },

  // Orange County / Pasadena / SD-adjacent
  {
    ownerKey: 3,
    cname: "Portola Coffee Lab",
    caddress: "331 W 4th St",
    ccity: "Santa Ana",
    czip: "92701",
    cphonenum: "714-555-0401",
    cdescription:
      "OC specialty coffee lab with experimental brewing and tasting flights.",
  },
  {
    ownerKey: 3,
    cname: "Kean Coffee Newport",
    caddress: "7960 E Coast Hwy",
    ccity: "Newport Beach",
    czip: "92657",
    cphonenum: "949-555-0402",
    cdescription:
      "Coastal Newport cafe from the Coffee Bean founders — smooth, classic espresso.",
  },
  {
    ownerKey: 3,
    cname: "Coffee Dose Costa Mesa",
    caddress: "3303 Hyland Ave",
    ccity: "Costa Mesa",
    czip: "92626",
    cphonenum: "714-555-0403",
    cdescription:
      "Modern Costa Mesa cafe with cold brew on tap and plenty of outlets.",
  },
  {
    ownerKey: 3,
    cname: "Jones Coffee Roasters",
    caddress: "808 Fair Oaks Ave",
    ccity: "Pasadena",
    czip: "91105",
    cphonenum: "626-555-0404",
    cdescription:
      "Pasadena institution roasting on-site with a huge single-origin menu.",
  },
  {
    ownerKey: 3,
    cname: "Urth Caffe Pasadena",
    caddress: "600 S Lake Ave",
    ccity: "Pasadena",
    czip: "91106",
    cphonenum: "626-555-0405",
    cdescription:
      "Organic cafe with patio brunch energy and fair-trade coffee.",
  },
  {
    ownerKey: 3,
    cname: "Bru Coffeehouse",
    caddress: "350 S Lake Ave",
    ccity: "Pasadena",
    czip: "91101",
    cphonenum: "626-555-0406",
    cdescription:
      "Lake Avenue favorite for students and remote workers.",
  },
  {
    ownerKey: 3,
    cname: "Coffee Commissary Pasadena",
    caddress: "16 N Marengo Ave",
    ccity: "Pasadena",
    czip: "91101",
    cphonenum: "626-555-0407",
    cdescription:
      "Old Town Pasadena coffee stop with polished espresso drinks.",
  },
  {
    ownerKey: 3,
    cname: "Philz Coffee Irvine",
    caddress: "4255 Campus Dr",
    ccity: "Irvine",
    czip: "92612",
    cphonenum: "949-555-0408",
    cdescription:
      "Custom-blended drip coffee near UCI — mint mojito iced coffee is a hit.",
  },
  {
    ownerKey: 3,
    cname: "Starbucks Reserve Irvine",
    caddress: "800 Spectrum Center Dr",
    ccity: "Irvine",
    czip: "92618",
    cphonenum: "949-555-0409",
    cdescription:
      "Large Spectrum-area cafe with reserve pour-overs and seating for groups.",
  },
  {
    ownerKey: 3,
    cname: "Local Coffee Claremont",
    caddress: "201 Yale Ave",
    ccity: "Claremont",
    czip: "91711",
    cphonenum: "909-555-0410",
    cdescription:
      "Village cafe near the colleges with leafy patio seating.",
  },
  {
    ownerKey: 3,
    cname: "Some Crust Bakery Cafe",
    caddress: "119 Yale Ave",
    ccity: "Claremont",
    czip: "91711",
    cphonenum: "909-555-0411",
    cdescription:
      "Bakery-cafe hybrid with espresso and legendary scones.",
  },
  {
    ownerKey: 0,
    cname: "Coffee Klatch Rancho Cucamonga",
    caddress: "9549 Foothill Blvd",
    ccity: "Rancho Cucamonga",
    czip: "91730",
    cphonenum: "909-555-0412",
    cdescription:
      "Inland Empire roasting pioneer with competition-winning espresso.",
  },
  {
    ownerKey: 0,
    cname: "Foothill Coffee House",
    caddress: "8686 Foothill Blvd",
    ccity: "Rancho Cucamonga",
    czip: "91730",
    cphonenum: "909-555-0413",
    cdescription:
      "Casual foothill cafe with big iced drinks and free parking.",
  },
  {
    ownerKey: 0,
    cname: "Ontario Mills Coffee Lab",
    caddress: "1 Mills Cir",
    ccity: "Ontario",
    czip: "91764",
    cphonenum: "909-555-0414",
    cdescription:
      "Mall-adjacent specialty lab for shoppers needing a caffeine reset.",
  },
  {
    ownerKey: 0,
    cname: "Chino Hills Pour House",
    caddress: "13920 City Center Dr",
    ccity: "Chino Hills",
    czip: "91709",
    cphonenum: "909-555-0415",
    cdescription:
      "Suburban specialty cafe with pour-over flights and quiet mornings.",
  },
  {
    ownerKey: 0,
    cname: "Corona Coffee Collective",
    caddress: "480 N Main St",
    ccity: "Corona",
    czip: "92880",
    cphonenum: "951-555-0416",
    cdescription:
      "Downtown Corona collective roasting local blends and hosting open mics.",
  },
  {
    ownerKey: 0,
    cname: "Norco Feed Store Cafe",
    caddress: "2870 Hammer Ave",
    ccity: "Norco",
    czip: "92860",
    cphonenum: "951-555-0417",
    cdescription:
      "Horse-town cafe with cowboy coffee, cold brew, and porch seating.",
  },
  {
    ownerKey: 1,
    cname: "Equator Coffees Culver City",
    caddress: "9303 Culver Blvd",
    ccity: "Culver City",
    czip: "90232",
    cphonenum: "310-555-0418",
    cdescription:
      "Bay Area roaster's Culver City cafe — bright, approachable espresso.",
  },
  {
    ownerKey: 1,
    cname: "Coffee Bean Brentwood",
    caddress: "11698 San Vicente Blvd",
    ccity: "Los Angeles",
    czip: "90049",
    cphonenum: "310-555-0419",
    cdescription:
      "Westside classic for ice blendeds and afternoon meetings.",
  },
  {
    ownerKey: 3,
    cname: "Balcony Coffee Huntington",
    caddress: "21022 Pacific Coast Hwy",
    ccity: "Huntington Beach",
    czip: "92648",
    cphonenum: "714-555-0420",
    cdescription:
      "Ocean-view coffee stop steps from the pier — perfect after a surf session.",
  },
]

const REVIEW_SNIPPETS = [
  "Great latte and plenty of outlets. Will be back.",
  "Quiet enough to study for hours. Cold brew was excellent.",
  "Friendly baristas and solid pour-over. Atmosphere is top-tier.",
  "A bit crowded on weekends, but the espresso is worth it.",
  "Loved the patio seating. Matcha latte was perfect.",
  "Pastries were fresh and the flat white was dialed in.",
  "Nice vibe for remote work. Wi-Fi was fast.",
  "One of the best cortados I've had in SoCal.",
  "Cozy interior, good music, and a smooth house blend.",
  "Came for coffee, stayed for the avocado toast.",
  "Service was quick even during the morning rush.",
  "Single-origin pour-over had amazing florals.",
]

// tags used for content-based recommendations
const SEED_TAGS = [
  "wifi",
  "study",
  "patio",
  "matcha",
  "quiet",
  "roastery",
  "pastries",
  "brunch",
  "cold-brew",
  "laptop-friendly",
  "live-music",
  "beach",
]

// keyword hints in cafe name/description → tag names (2–4 tags applied per cafe)
const TAG_HINTS = [
  { tag: "wifi", words: ["wifi", "wi-fi", "laptop", "remote", "outlets", "study"] },
  { tag: "study", words: ["study", "student", "quiet", "laptop", "campus", "ucr", "uci"] },
  { tag: "patio", words: ["patio", "outdoor", "porch", "seating"] },
  { tag: "matcha", words: ["matcha"] },
  { tag: "quiet", words: ["quiet", "minimalist", "sleek", "study"] },
  { tag: "roastery", words: ["roast", "roaster", "single-origin", "specialty", "lab"] },
  { tag: "pastries", words: ["pastry", "pastries", "bakery", "croissant", "cake", "scone", "doughnut"] },
  { tag: "brunch", words: ["brunch", "breakfast", "toast", "avocado"] },
  { tag: "cold-brew", words: ["cold brew", "nitro", "iced"] },
  { tag: "laptop-friendly", words: ["laptop", "remote", "wifi", "outlets", "workers"] },
  { tag: "live-music", words: ["live music", "open mic", "music nights"] },
  { tag: "beach", words: ["beach", "surf", "ocean", "coastal", "pier", "venice"] },
]

function tagsForCafe(cafe) {
  const text = `${cafe.cname} ${cafe.cdescription}`.toLowerCase()
  const matched = []
  for (const hint of TAG_HINTS) {
    if (hint.words.some((w) => text.includes(w))) {
      matched.push(hint.tag)
    }
  }
  // always give at least a couple of tags so similarity has something to work with
  const fallback = ["roastery", "wifi", "pastries", "quiet"]
  let i = 0
  while (matched.length < 2 && i < fallback.length) {
    if (!matched.includes(fallback[i])) matched.push(fallback[i])
    i++
  }
  return matched.slice(0, 4)
}

// ensure recommendation tables exist even if DB was created before schema.sql was updated
async function ensureRecTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS tags (
      tid   SERIAL PRIMARY KEY,
      tname TEXT UNIQUE NOT NULL
    )
  `)
  await client.query(`
    CREATE TABLE IF NOT EXISTS cafe_tags (
      cafe_id INTEGER NOT NULL REFERENCES cafes(cid) ON DELETE CASCADE,
      tag_id  INTEGER NOT NULL REFERENCES tags(tid) ON DELETE CASCADE,
      PRIMARY KEY (cafe_id, tag_id)
    )
  `)
  await client.query(`
    CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
      cafe_id INTEGER NOT NULL REFERENCES cafes(cid) ON DELETE CASCADE,
      PRIMARY KEY (user_id, cafe_id)
    )
  `)
  // optional column for ranking by recent taste; ignore if already present
  await client.query(`
    ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `)
}

// create user if they dont exist yet, otherwise just return their id
async function upsertUser(client, user, passwordHash) {
  const existing = await client.query(
    "SELECT uid, urole FROM users WHERE uemail = $1",
    [user.uemail]
  )
  if (existing.rows.length) {
    return existing.rows[0].uid
  }
  const result = await client.query(
    `INSERT INTO users (uname, uemail, upassword, pfp, urole)
     VALUES ($1, $2, $3, NULL, $4)
     RETURNING uid`,
    [user.uname, user.uemail, passwordHash, user.urole]
  )
  return result.rows[0].uid
}

async function cafeExists(client, cname, ccity) {
  const result = await client.query(
    "SELECT cid FROM cafes WHERE cname = $1 AND ccity = $2",
    [cname, ccity]
  )
  return result.rows[0]?.cid ?? null
}

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Check your .env file.")
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  console.log("Connected to Postgres")

  try {
    await client.query("BEGIN")

    // create tags / cafe_tags / favorites if this DB predates the schema update
    await ensureRecTables(client)

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)
    const userIds = []

    // create all the seed users first
    for (const user of SEED_USERS) {
      const uid = await upsertUser(client, user, passwordHash)
      userIds.push(uid)
      console.log(`User ready: ${user.uname} (uid=${uid}, ${user.urole})`)
    }

    // also grab any owners already in the db so cafes get assigned properly
    const existingOwners = await client.query(
      "SELECT uid FROM users WHERE urole = 'owner' ORDER BY uid"
    )
    const ownerPool = [
      ...new Set([...userIds.slice(0, 4), ...existingOwners.rows.map((r) => r.uid)]),
    ]

    let insertedCafes = 0
    let skippedCafes = 0
    const cafeIds = []

    // add cafes one by one, skip if that name+city already exists
    for (let i = 0; i < CAFES.length; i++) {
      const cafe = CAFES[i]
      const existingId = await cafeExists(client, cafe.cname, cafe.ccity)
      if (existingId) {
        cafeIds.push(existingId)
        skippedCafes++
        continue
      }

      const ownerId = userIds[cafe.ownerKey] ?? ownerPool[i % ownerPool.length]
      const img = CAFE_IMAGES[i % CAFE_IMAGES.length]

      const result = await client.query(
        `INSERT INTO cafes
          (owner_id, cname, caddress, ccity, czip, cphonenum, cdescription, cafe_img)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING cid`,
        [
          ownerId,
          cafe.cname,
          cafe.caddress,
          cafe.ccity,
          cafe.czip,
          cafe.cphonenum,
          cafe.cdescription,
          img,
        ]
      )
      cafeIds.push(result.rows[0].cid)
      insertedCafes++
    }

    // upsert tag catalog
    const tagIdByName = {}
    for (const tname of SEED_TAGS) {
      const tagResult = await client.query(
        `INSERT INTO tags (tname) VALUES ($1)
         ON CONFLICT (tname) DO UPDATE SET tname = EXCLUDED.tname
         RETURNING tid, tname`,
        [tname]
      )
      tagIdByName[tagResult.rows[0].tname] = tagResult.rows[0].tid
    }
    console.log(`Tags ready: ${SEED_TAGS.length}`)

    // attach 2–4 tags to every seed cafe (idempotent)
    let linkedTags = 0
    for (let i = 0; i < CAFES.length; i++) {
      const cid = cafeIds[i]
      if (!cid) continue
      const tagNames = tagsForCafe(CAFES[i])
      for (const tname of tagNames) {
        const tid = tagIdByName[tname]
        if (!tid) continue
        const link = await client.query(
          `INSERT INTO cafe_tags (cafe_id, tag_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [cid, tid]
        )
        linkedTags += link.rowCount
      }
    }

    // add sample review posts if the posts table is empty
    const postCount = await client.query("SELECT COUNT(*)::int AS n FROM posts")
    let insertedPosts = 0

    if (postCount.rows[0].n === 0 && cafeIds.length) {
      const reviewerIds = userIds.slice(4) // seed users with role user
      // fallback to any non-owner if seed reviewers somehow missing
      if (!reviewerIds.length) {
        const users = await client.query(
          "SELECT uid FROM users WHERE urole = 'user' LIMIT 5"
        )
        reviewerIds.push(...users.rows.map((r) => r.uid))
      }

      for (let i = 0; i < cafeIds.length; i++) {
        const reviewsForCafe = 1 + (i % 3) // 1–3 reviews each
        for (let r = 0; r < reviewsForCafe; r++) {
          const userId = reviewerIds[(i + r) % reviewerIds.length]
          const rating = 3 + ((i + r) % 3) // 3, 4, or 5
          const description =
            REVIEW_SNIPPETS[(i * 3 + r) % REVIEW_SNIPPETS.length]
          const image =
            r === 0 ? CAFE_IMAGES[(i + r) % CAFE_IMAGES.length] : null

          await client.query(
            `INSERT INTO posts (cafe_id, user_id, image, description, rating)
             VALUES ($1, $2, $3, $4, $5)`,
            [cafeIds[i], userId, image, description, rating]
          )
          insertedPosts++
        }
      }
    }

    // sample favorites for reviewer seed users (maya / jordan / sam)
    let insertedFavorites = 0
    const favoritePairs = [
      [4, 0],  // maya → The Arcade Coffee Roasters
      [4, 1],  // maya → Condron Coffee
      [4, 9],  // maya → Hidden Grounds Riverside
      [5, 18], // jordan → Maru Coffee
      [5, 26], // jordan → Cafe Dulce Little Tokyo
      [5, 1],  // jordan → Condron Coffee
      [6, 37], // sam → Bru Coffeehouse
      [6, 9],  // sam → Hidden Grounds Riverside
      [6, 41], // sam → Local Coffee Claremont
    ]
    for (const [userIdx, cafeIdx] of favoritePairs) {
      const uid = userIds[userIdx]
      const cid = cafeIds[cafeIdx]
      if (!uid || !cid) continue
      const fav = await client.query(
        `INSERT INTO favorites (user_id, cafe_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [uid, cid]
      )
      insertedFavorites += fav.rowCount
    }

    await client.query("COMMIT")

    const totals = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM cafes) AS cafes,
        (SELECT COUNT(*)::int FROM posts) AS posts,
        (SELECT COUNT(*)::int FROM tags) AS tags,
        (SELECT COUNT(*)::int FROM cafe_tags) AS cafe_tags,
        (SELECT COUNT(*)::int FROM favorites) AS favorites
    `)

    console.log("\nSeed complete.")
    console.log(`  Cafes inserted: ${insertedCafes} (skipped existing: ${skippedCafes})`)
    console.log(`  Posts inserted: ${insertedPosts}`)
    console.log(`  Cafe-tag links added: ${linkedTags}`)
    console.log(`  Favorites inserted: ${insertedFavorites}`)
    console.log(
      `  Totals → users: ${totals.rows[0].users}, cafes: ${totals.rows[0].cafes}, posts: ${totals.rows[0].posts}, tags: ${totals.rows[0].tags}, cafe_tags: ${totals.rows[0].cafe_tags}, favorites: ${totals.rows[0].favorites}`
    )
    console.log(`\nSeed logins (password: ${DEFAULT_PASSWORD}):`)
    for (const u of SEED_USERS) {
      console.log(`  ${u.uemail}  [${u.urole}]`)
    }
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    await client.end()
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err.message)
  process.exit(1)
})
