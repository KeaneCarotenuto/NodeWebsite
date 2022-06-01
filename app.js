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

var datetime = new Date();

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
    },

    //temp username that gets updated when user logs in
    username: {
        type: String,
        default: "Anonymous"
    }
});

//create user schema
const UserSchema = new mongoose.Schema({
    username: { type : String, required: true, unique: true },
    //password: { type : String, required: true },
    email: String,

    //list of post
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
    res.redirect('/feed');
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

    //get all users
    User.find({}, function(err, users) {
        if (err) {
            console.log(err);
            return res.redirect('/');
        }

        var allUsers = [];
        var allPosts = [];

        users.forEach(function(user) {
            allUsers.push(user);
            console.log(user.username);
        });

        console.log("Users: " + allUsers.length);

        //get all posts from users
        for (var i = 0; i < allUsers.length; i++){
            for (var j = 0; j < allUsers[i].posts.length; j++){
                allPosts.push(allUsers[i].posts[j]);
            }
        }

        //sort posts by date
        allPosts.sort(function(a, b){
            return new Date(b.date) - new Date(a.date);
        });

        console.log("Posts: " + allPosts.length);

        res.render('feed.ejs', {currentUser : req.user, allUsers : allUsers, allPosts : allPosts});
    });
});

app.get('/fullywhite', (req,res) => {
	createCat('Fluffy', 2, 'white');
});

app.get('/socksblack', (req,res) => {
	createCat('Socks', 2, 'black');
});

//this user profile
app.get('/profile', (req, res) => {
    if (!req.isAuthenticated()){
        res.redirect('/');
    }
    else{
        User.findById(req.user._id, (err, user) => {
            if(err){
                console.log(err);
                return res.redirect('/');
            }
            else{
                res.redirect('/profile/' + user.username);
            }
        });
    }
});

//specific profile
app.get('/profile/:username', (req,res) => {
    var username = req.params.username;

    User.findOne({username: username}, (err, user) => {
        if(err){
            console.log(err);
            return res.redirect('/');
        }
        else{
            //if user does not exist redirect to home
            if(!user){
                return res.redirect('/');
            }

            //disable caching
            res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
            res.header('Expires', '-1');
            res.header('Pragma', 'no-cache');

            //update all of this user's posts
            for (var i = 0; i < user.posts.length; i++){
                //update username
                user.posts[i].username = user.username;
            }
            //save user
            user.save();

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
    if (!req.isAuthenticated() || req.user == null || req.user == undefined || req.user == ""){
        res.redirect('/');
    }

    var title = req.body.title;
    var content = req.body.content;
    var fishInfospecies = req.body.species;
    var fishInfolength = req.body.length;
    var fishInfoweight = req.body.weight;
    var image = req.body.image;
    var date = datetime.toISOString().slice(0,10);
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
        user: userOBjectId,
        username: username
    });

    User.findOne({username: username}, (err, user) => {
        if (err) {
            console.log(err);
            return res.send("Error: " + err);
        }
        else{
            user.posts.push(newPost);
            user.save((err, user) => {
                if (err) {
                    console.log(err);
                    return res.send("Error: " + err);
                }
                else{
                    res.redirect('back');
                }
            });
        }
    });
});

//delete post
app.delete('/profile/:username/:id', (req, res) => {
    if (!req.isAuthenticated()){
        res.redirect('/');
        return;
    }

    var username = req.params.username;
    var postid = req.params.id;
    console.log("Want to delete post " + postid);
    
    
    User.findOne({username: username}, (err, user) => {
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

//edit post
app.put('/profile/:username/:id', (req,res) => {
    if (!req.isAuthenticated()){
        res.redirect('/');
        return;
    }

    var username = req.params.username;
    var postid = req.params.id;
    var title = req.body.title;
    var content = req.body.content;
    var fishInfospecies = req.body.species;
    var fishInfolength = req.body.length;
    var fishInfoweight = req.body.weight;
    var image = req.body.image;

    console.log("username: " + username + " postid: " + postid + " title: " + title + " content: " + content + " fishInfospecies: " + fishInfospecies + " fishInfolength: " + fishInfolength + " fishInfoweight: " + fishInfoweight + " image: " + image);

    User.findOne({username: username}, (err, user) => {
        if (err) {
            console.log(err);
            return res.send("Error: " + err);
        }
        else{
            //check if current user is the owner of the post
            if (user.username != req.user.username){
                return res.send("Error: You are not the owner of this post");
            }

            console.log("user: " + user);
            console.log("user.posts: " + user.posts);
            console.log("user.posts[0].id: " + user.posts[0]._id);

            //find post with postid in array
            var post = user.posts.find(post => post._id == postid);
            
            post.title = title;
            post.content = content;
            post.fishInfo.species = fishInfospecies;
            post.fishInfo.length = fishInfolength;
            post.fishInfo.weight = fishInfoweight;
            post.image = image;
            post.username = username;

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