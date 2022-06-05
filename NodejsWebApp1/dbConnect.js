'use strict';

var mysql = require("mysql");
var mysqlConfig = {
    host: "localhost",
    user: "root",
    password: "mysql",
    database: "exampleDB"
};


var sqlString = "SELECT E1.id AS parentId, E1.item AS parent, E2.id AS childId, E2.item AS child \
    FROM relationship R \
    LEFT JOIN exampleTable E1 ON R.parentId = E1.id \
    LEFT JOIN exampleTable E2 ON R.childId = E2.id \
    ORDER BY R.parentId, R.childId;";

function getData(callback) {
    let connection = mysql.createConnection(mysqlConfig);
    connection.query(sqlString, (err, results, fields) => {
        if (err) throw err;
        callback(results);
    });
    connection.end();
}

module.exports = { getData };