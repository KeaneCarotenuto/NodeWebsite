const express = require('express');
var methodOverride = require('method-override');
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

var ObjectId = require('mongodb').ObjectId;

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

//exec("start cmd /c lt --port 4000")

//session middleware
app.use(sessions({
    secret: "thisismysecrctekeyfhnorgfgrfrty84fwir767",
    saveUninitialized:true,
    cookie: { maxAge: oneDay },
    resave: false
}));

//override with POST having ?_method=DELETE
app.use(methodOverride('_method'));

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

//create fish info schema
const fishInfoSchema = new mongoose.Schema({
    species : String,
    length : Number,
    weight : Number
});

//create fishing post schema (title, description, fish info, image, date, username)
const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    fishInfo: fishInfoSchema,
    image: String,
    date: String,

    //user id
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
});

//create user schema
const UserSchema = new mongoose.Schema({
    username: { type : String, required: true, unique: true },
    //password: { type : String, required: true },
    email: String,

    //posts
    posts: [postSchema]
});

//add passport-local-mongoose plugin
UserSchema.plugin(passportLocalMongoose);

//create models
//fish
const Fish = mongoose.model("Fish", fishInfoSchema);

//post
const Post = mongoose.model("Post", postSchema);

//user
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
        res.redirect('/feed');
    }
    else {
        res.redirect('/login');
    }
});

//login
app.get('/login', (req, res) => {
    if(req.isAuthenticated()){
        res.redirect('/profile');
    }
    else{
        res.render('login.ejs', {currentUser : req.user});
    }
});

//sign up
app.get('/newuser',(req,res) => {
    res.render('newuser.ejs', {currentUser : req.user});
});

//feed
app.get('/feed', (req, res) => {
    res.render('feed.ejs', {currentUser : req.user});
});

app.get('/fullywhite', (req,res) => {
	createCat('Fluffy', 2, 'white');
});

app.get('/socksblack', (req,res) => {
	createCat('Socks', 2, 'black');
});

app.get('/profile/:username', (req,res) => {
    //render needs title and user
    //res.render('profile.ejs',{title: session.userid + "'s Profile", username: session.userid});
    // if (!req.isAuthenticated()){
    //     res.redirect('/');
    // }

    var username = req.params.username;

    User.findOne({username: username}, (err, user) => {
        if(err){
            console.log(err);
        }
        else{
            res.render('profile.ejs', {currentUser : req.user, profileUser : user});
        }
    });
});

function isloggedin(req,res,next){
    if (req.isAuthenticated()){
        return next();
    }
    res.redirect('/');
}

function ValidateUsername(username){
    console.log("Checking " + username + " for validity");

    //check length
    if(username.length < 3 || username.length > 20){
        return false;
    }

    //check no special characters
    var regex = /^[a-zA-Z0-9]+$/;
    if(!regex.test(username)){
        return false;
    }

    //check if username is taken
    User.findOne({username: username}, (err, user) => {
        if (err) {
            console.log(err);
            return false;
        }
        if (user) {
            return false;
        }
    });

    return true;
}

// login
app.post('/dosignin', passport.authenticate('local', {
    successRedirect: '/profile',
    failureRedirect: '/'
    }), (req, res) => {
        
});

//create new user
app.post('/dosignup',(req,res) => {
    var username = req.body.username;
    var password = req.body.password;

    if (ValidateUsername(username) == false){
        res.redirect('/newuser');
        return;
    }
    console.log("Creating new user " + username);

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

//create post
app.post('/newpost', (req, res) => {
    var title = req.body.title;
    var content = req.body.content;
    var fishInfospecies = req.body.species;
    var fishInfolength = req.body.length;
    var fishInfoweight = req.body.weight;
    var image = req.body.image;
    var date = req.body.date;
    var username = req.user.username;
    var userOBjectId = req.user._id;


    var newFish = new Fish({
        species: fishInfospecies,
        length: fishInfolength,
        weight: fishInfoweight
    });

    var newPost = new Post({
        title: title,
        content: content,
        fishInfo: newFish,
        image: image,
        date: date,
        user: userOBjectId
    });

    newPost.save((err, post) => {
        if(err){
            console.log(err);
            return res.send("Error: " + err);
        }
        else{
            User.findOne({username: username}, (err, user) => {
                if (err) {
                    console.log(err);
                    return res.send("Error: " + err);
                }
                else{
                    user.posts.push(post);
                    user.save((err, user) => {
                        if (err) {
                            console.log(err);
                            return res.send("Error: " + err);
                        }
                        else{
                            res.redirect('/feed');
                        }
                    });
                }
            });
        }
    });
});

//delete post
app.delete('/posts/:id', (req, res) => {
    if (!req.isAuthenticated()){
        res.redirect('/');
        return;
    }

    var postid = req.params.id;
    console.log("Want to delete post " + postid);
    
    
    Post.findOneAndDelete({_id: postid}, (err, post) => {
        if (err) {
            console.log(err);
            return res.send("Error: " + err);
        }
        else{
            console.log("POST IN QUESTION " + post);
            User.findOne({_id: new ObjectId(post.user)}, (err, user) => {
                if (err) {
                    console.log(err);
                    return res.send("Error: " + err);
                }
                else{
                    console.log(user);
                    //check if current user is the owner of the post
                    if (user.username != req.user.username){
                        return res.send("Error: You are not the owner of this post");
                    }

                    user.posts.pull(postid);
                    user.save((err, user) => {
                        if (err) {
                            console.log(err);
                            return res.send("Error: " + err);
                        }
                        else{
                            res.redirect('/profile');
                        }
                    });
                }
            });
        }
    });
});

//edit profile (only username)
app.put('/editprofile', (req,res) => {
    var username = req.user.username;
    var newUsername = req.body.username;

    if (ValidateUsername(newUsername) == false){
        console.log("Invalid username");
        res.redirect('/profile');
        return;
    }

    console.log("username: " + username + " newUsername: " + newUsername);

    User.findOneAndUpdate({username: username}, {username: newUsername}, (err, user) => {
        if(err){
            console.log(err);
            return res.send("Error: " + err);
        }
        else{
            res.redirect('/profile');
        }
    });
});


//logut
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