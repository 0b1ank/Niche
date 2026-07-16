require("dotenv").config() //uses dotenv to parse the .env file and grab necessary info
const express = require("express")
const { client } = require("./config/db")

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({extended: false}))

app.get("/", (req, res) => {
    res.send("hello from backend")
})

app.get("/db-check", async(req, res) => {
    try {
        const result = await client.query("SELECT NOW() AS now")
        res.json({ok: true, now: result.rows[0].now})

    }catch (err){
        res.status(500).json({ok: false, error: err.message})
    }
})


app.listen(PORT, () => {
    console.log(`listening on ${PORT}`)
})