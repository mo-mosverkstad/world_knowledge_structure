'use strict';

const dbConnect = require("./dbConnect");
const dataConvert = require("./dataConvert");
const fs = require("fs");

const express = require("express");
const path = require("path");
const app = express();

const port = 1337;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

function callbackGetData(results) {
    console.log(results);
    let dataTree = {};
    const initId = 10;
    dataConvert.convertTree(results, dataTree, initId, dataConvert.getItem(results, initId));
    fs.writeFile("./public/js/dataContents.json", "parsedData='" + JSON.stringify(dataTree) + "';", function (error) {
        if (error) throw error;
        console.log("File writing to ./public/js/dataContents.json is done!")
    })
}

dbConnect.getData(callbackGetData);

app.get("/", (req, res) => {
    res.render("index");
});

app.listen(port, () => {
    console.log("server started on 1337");
})




