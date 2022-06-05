'use strict';

const dbBusiness = require('./database/dbBusiness');

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

const port = 1337;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
    dbBusiness.generateParsedDataByRelationship(path.join(__dirname, "public") + '/js/dataContents.json');
    res.render("index");
    res.end();
});

app.get("/login", (req, res) => {
    res.render("login");
    res.end();
});

app.post("/auth", function (req, res) {
	var username = req.body.username;
    var password = req.body.password;
    console.log(username, ":", password);
    req.session.loggedin = true;
    req.session.username = username;
    res.redirect('/edit');
    res.end();
});

app.get("/edit", (req, res) => {
    if (req.session.loggedin) {
        res.render("edit");
    } else {
        res.render("login");
    }
    res.end();
});

app.post("/additem", function (req, res) {
    console.log(req.body);
    req.session.loggedin = true;
    req.session.something = "something";
    console.log(req.session);
    res.redirect('/edit');
    res.end();
});

app.get("/logout", function (req, res) {
    req.session.loggedin = false;
    res.redirect('/');
    res.end();
});

app.listen(port, '127.0.0.1', () => {
    console.log(`server running on ${port}`);
});