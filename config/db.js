// connects to postgres using the url from .env
const{ Client } = require("pg")

const client = new Client({
    connectionString: process.env.DATABASE_URL
})

// open the connection when the app starts
client
    .connect()
    .then(()=> console.log("connected to pg"))
    .catch((err) => {
        console.error("can't connect to pg", err.message)
    })

    module.exports = { client }