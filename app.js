const express = require('express');
const cookieParser = require("cookie-parser");
const sessions = require('express-session');
const { restart } = require('nodemon');
var fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = 4000;

// creating 24 hours from milliseconds
const oneDay = 1000 * 60 * 60 * 24;

app.set("view engine", "pug");

exec("start cmd /c lt --port 4000")

//session middleware
app.use(sessions({
    secret: "thisismysecrctekeyfhnorgfgrfrty84fwir767",
    saveUninitialized:true,
    cookie: { maxAge: oneDay },
    resave: false
}));

// parsing the incoming data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//serving public file
app.use(express.static(__dirname));

// cookie parser middleware
app.use(cookieParser());

// a variable to save a session
var session;

app.get("/", (req, res) => {
    res.redirect('/landing');
});

app.get('/landing',(req,res) => {
    session=req.session;
    if(session.userid){
        res.setHeader('Content-Type', 'text/html');
        res.write("<h2>Welcome "+session.userid+"</h2>");
        //go to profile
        res.write("<a href='/profile'>Profile</a><br>");
        res.write("<a href='/logout'>Logout</a>");
        res.end();
    }else
    res.sendFile('views/login.html',{root:__dirname})
});

app.get('/newuser',(req,res) => {
    res.sendFile('views/newuser.html',{root:__dirname})
});

app.get('/profile',(req,res) => {
    session=req.session;
    if(session.userid){
        res.render('profile.ejs',{title: session.userid + "'s Profile", username: session.userid});
    }
    else{
        res.redirect('/');
    }
});

app.post('/dosignin',(req,res) => {    
    // let db = new sqlite3.Database('./db/database.db');
    // db.get("SELECT password FROM logins WHERE username = ?", [req.body.username], (err,row) => {
    //     if(err) {
    //         console.log(err.message);
    //     }
    //     if(row){
    //         if(row.password === req.body.password){
    //             session = req.session;
    //             session.userid = req.body.username;
    //             console.log(session);
    //             res.redirect('/');
    //         }else{
    //             res.send("Invalid Password <a href=\'/\'>click to go back</a>");
    //         }
    //     }else{
    //         res.send("Invalid Username <a href=\'/\'>click to go back</a>");
    //     }
    // });

    // db.close();
})

app.post('/dosignup',(req,res) => {
    //+check that both passwords match
    // if(req.body.password === req.body.confirmpassword){
    //     let db = new sqlite3.Database('./db/database.db');
    //     db.run("INSERT INTO logins (username,password) VALUES (?,?)", [req.body.username,req.body.password], (err) => {
    //         if(err) {
    //             console.log(err.message);
    //         }
    //         console.log("New user created");
    //     });
    //     db.close();
    //     res.redirect('/');
    // }
    // else{
    //     res.send("Passwords do not match <a href=\'/newuser\'>click to go back</a>");
    // }
})

app.get('/logout',(req,res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(PORT, () => console.log(`Server Running at port ${PORT}`));