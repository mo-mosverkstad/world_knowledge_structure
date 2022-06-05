'use strict';

const dbConnect = require('./dbConnect');
const sqlCommands = require('./sqlCommands');
const dataConvert = require('../helper/dataConvert');
const fs = require("fs");

async function generateParsedDataByRelationship(dataFilePath) {
    const results = await dbConnect.query(sqlCommands.sqlQueryRelationship);
    console.log(results);
    let dataTree = {};
    const initId = 10;
    dataConvert.convertTree(results, dataTree, initId, dataConvert.getItem(results, initId));
    fs.writeFile(dataFilePath, "var parsedData = JSON.parse('" + JSON.stringify(dataTree) + "');", function (error) {
        if (error) throw error;
        console.log("File of parsedData writing to ./public/js/dataContents.json is done!")
    })
}

module.exports = {
    generateParsedDataByRelationship,
};