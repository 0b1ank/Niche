//Purpose: Opens the connection portal to the database

const{ Client } = require("pg")

//Builds the connection object 
const client = new Client({
    //connectionString helps pass the information into the correct fields
    connectionString: process.env.DATABASE_URL //dotenv puts DATABASE_URL and PORT on process.env,
})

//opens TCP/socket connection to Postgres
client
    .connect()
    .then(()=> console.log("connected to pg"))
    .catch((err) => {
        console.error("can't connect to pg", err.message)
    })

    module.exports = { client }