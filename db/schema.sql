CREATE TABLE users (
  uid       SERIAL PRIMARY KEY,
  uname     TEXT NOT NULL,
  uemail    TEXT UNIQUE NOT NULL,
  upassword TEXT, -- nullable so Google-only accounts can exist
  pfp       TEXT,
  google_id TEXT UNIQUE,
  urole     TEXT NOT NULL DEFAULT 'user' CHECK (urole IN ('user', 'owner'))
);

CREATE TABLE cafes (
  cid          SERIAL PRIMARY KEY,
  owner_id     INTEGER NOT NULL REFERENCES users(uid),
  cname        TEXT,
  caddress     TEXT,
  ccity        TEXT,
  czip         TEXT,
  cphonenum    TEXT,
  cdescription TEXT, 
  cafe_img     TEXT
);

CREATE TABLE posts (
  pid         SERIAL PRIMARY KEY,
  cafe_id     INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  image       TEXT,
  description TEXT,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (cafe_id) REFERENCES cafes(cid),
  FOREIGN KEY (user_id) REFERENCES users(uid)
);

-- recommendation attributes: tags for content similarity, favorites for personal taste
CREATE TABLE tags (
  tid   SERIAL PRIMARY KEY,
  tname TEXT UNIQUE NOT NULL
);

CREATE TABLE cafe_tags (
  cafe_id INTEGER NOT NULL REFERENCES cafes(cid) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(tid) ON DELETE CASCADE,
  PRIMARY KEY (cafe_id, tag_id)
);

CREATE TABLE favorites (
  user_id INTEGER NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
  cafe_id INTEGER NOT NULL REFERENCES cafes(cid) ON DELETE CASCADE,
  PRIMARY KEY (user_id, cafe_id)
);
