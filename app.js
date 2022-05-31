const express = require('express');
const cookieParser = require("cookie-parser");
const sessions = require('express-session');
const { restart } = require('nodemon');
var fs = require('fs');
const { exec } = require('child_process');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var passport = require('passport');
var localStrategy = require('passport-local');
var passportLocalMongoose = require('passport-local-mongoose');

mongoose.connect('mongodb://localhost/db_app', {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});

//use express
const app = express();
const PORT = 4000;

// creating 24 hours from milliseconds
const oneDay = 1000 * 60 * 60 * 24;

app.set("view engine", "ejs");

exec("start cmd /c lt --port 4000")

//session middleware
app.use(sessions({
    secret: "thisismysecrctekeyfhnorgfgrfrty84fwir767",
    saveUninitialized:true,
    cookie: { maxAge: oneDay },
    resave: false
}));

//passport
app.use(passport.initialize());
app.use(passport.session());

// parsing the incoming data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//serving public file
app.use(express.static(__dirname));

//body parser
app.use(bodyParser.urlencoded({ extended: true }));

// cookie parser middleware
app.use(cookieParser());


// ++++++++++++++++++++++++++++++++++++
// MODELS
// ++++++++++++++++++++++++++++++++++++

//create user schema
const UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    email: String
});

//add passport-local-mongoose plugin
UserSchema.plugin(passportLocalMongoose);

//create model
const User = mongoose.model('User', UserSchema);

//passport config
passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// a variable to save a session
var session;

app.get("/", (req, res) => {
    res.redirect('/landing');
});

app.get('/landing',(req,res) => {
    session = req.session;
    if(req.isAuthenticated()){
        res.setHeader('Content-Type', 'text/html');
        res.write("<h2>Welcome "+ req.user.username +"</h2>");
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

app.get('/fullywhite', (req,res) => {
	createCat('Fluffy', 2, 'white');
});

app.get('/socksblack', (req,res) => {
	createCat('Socks', 2, 'black');
});

app.get('/profile', (req,res) => {
    //render needs title and user
    //res.render('profile.ejs',{title: session.userid + "'s Profile", username: session.userid});
    if (req.isAuthenticated()){
        res.render('profile.ejs', {
            title: req.user.username + '\'s' + 'Profile',
            user: req.user
        });
    }
    else{
        res.redirect('/');
    }
});

function isloggedin(req,res,next){
    if (req.isAuthenticated()){
        return next();
    }
    res.redirect('/');
}

app.post('/dosignin', passport.authenticate('local', {
    successRedirect: '/profile',
    failureRedirect: '/'
    }), (req, res) => {
        
});

app.post('/dosignup',(req,res) => {
    var username = req.body.username;
    var password = req.body.password;

    var newUser = new User({
        username: username
    });

    //dont save password, save hashed password
    User.register(newUser, password, (err, user) => {
        if(err){
            console.log(err);
            return res.send("Error: " + err);
        }
        else{
            passport.authenticate('local')(req, res, () => {
                res.redirect('/');
            });
        }
    });
});

app.get('/logout',(req,res) => {
    req.logout(function(err){
        if(err){
            console.log(err);
            return res.send("Error: " + err);
        }
        res.redirect('/');
    });
});

app.listen(PORT, () => console.log(`Server Running at port ${PORT}`));