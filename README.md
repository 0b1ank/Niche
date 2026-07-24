# cafe-sharing-app
Node/Express cafe sharing website with PostgreSQL.
## What you need
- Node.js
- PostgreSQL
## Setup
1. Install packages
```
npm install
```
2. Make a postgres database
```
psql postgres
CREATE DATABASE cafe_sharing;
\q
```
3. Make a .env file in the project root
```
DATABASE_URL=postgresql://YOUR_USERNAME@localhost:5432/cafe_sharing
PORT=3000
SESSION_SECRET=some-random-string
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```
Change YOUR_USERNAME to your postgres username. Google stuff is optional.
4. Create tables
```
psql postgresql://YOUR_USERNAME@localhost:5432/cafe_sharing -f db/schema.sql
```
5. Add sample data
```
npm run seed
```
6. Start the server
```
npm run devStart
```
7. Open http://localhost:3000
## Seed logins
password for all of these is password123
arcade@cafeseed.test (owner)
la.roaster@cafeseed.test (owner)
ie.coffee@cafeseed.test (owner)
oc.barista@cafeseed.test (owner)
maya@cafeseed.test (user)
jordan@cafeseed.test (user)
sam@cafeseed.test (user)
## Using the app
- / register and login
- owners can add cafes at /cafes/new
- users can make reviews at /create-post
- /profile shows your stuff
## Other commands
npm run seed - load sample data
node server.js - start without nodemon
http://localhost:3000/db-check - check if db works
## If something breaks
- make sure postgres is running
- make sure .env exists and DATABASE_URL is right
- make sure you ran schema.sql before seed
- if port 3000 is taken change PORT in .env
