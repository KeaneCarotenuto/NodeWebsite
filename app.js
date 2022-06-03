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

mongoose.connect('mongodb+srv://Keane:19jvtD6NrsaSapFp@cluster0.wkiy3wk.mongodb.net/?retryWrites=true&w=majority', {
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
app.use(express.static(__dirname + '/public'));

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

// comment structure
const commentSchema = new mongoose.Schema({
    text : String,
    //user id
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    username: String,
    date : String
});

//create fishing post schema (title, description, fish info, image, date, username)
const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    fishInfo: fishInfoSchema,
    image: String,
    date: String,

    // comment
    comments: [commentSchema],

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
// fish
const Fish = mongoose.model("Fish", fishInfoSchema);

// comment
const Comment = mongoose.model("Comment", commentSchema);

// post
const Post = mongoose.model("Post", postSchema);

// user
const User = mongoose.model('User', UserSchema);



//passport config
passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// a variable to save a session
var session;

// default route
app.get("/", (req, res) => {
    res.redirect('/landing');
});

// landing page
app.get("/landing", (req, res) => {
    res.render("landing.ejs", {currentUser: req.user});
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

            res.render('profile.ejs', {currentUser : req.user, profileUser : user});
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

// delete profile
app.delete('/profile/:username', (req,res) => {
    var username = req.params.username;

    // check if user is logged in and if they are the same user
    if(!req.isAuthenticated() || req.user.username != username){
        res.redirect('/');
        return;
    }

    User.findOneAndRemove({username: username}, (err, user) => {
        if(err){
            console.log(err);
            return res.send("Error: " + err);
        }
        else{
            // find all users, update all posts's comments to have the current user's username
            User.find({}, (err, users) => {
                if (err) {
                    console.log(err);
                    return res.send("Error: " + err);
                }
                else{
                    for (var i = 0; i < users.length; i++){
                        console.log("updating comments for " + users[i].username);
                        for (var j = 0; j < users[i].posts.length; j++){
                            console.log("- post " + j);
                            //update username
                            users[i].posts[j].comments.forEach(comment => {
                                if (comment.username == username){
                                    console.log("---- updating comment username");
                                    comment.username = "test";
                                }
                            });
                        }
                        //save user
                        users[i].save();
                    }
                }
            });

            res.redirect('/');
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
    if (isValidURL(image) == false){
        image = "";
    };
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
    if (isValidURL(image) == false){
        image = "";
    };

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
                    res.redirect('back');
                }
            });
        }
    });
});

//view post
app.get('/profile/:username/:id', (req, res) => {
    console.log("view post");

    // if (!req.isAuthenticated()){
    //     res.redirect('/');
    //     return;
    // }

    var username = req.params.username;
    var postid = req.params.id;

    console.log("username: " + username + " postid: " + postid);

    User.findOne({username: username}, (err, user) => {
        if (err) {
            console.log(err);
            return res.send("Error: " + err);
        }
        else{
            if (!user){
                return res.send("Error: User not found");
            }

            var post = user.posts.find(post => post._id == postid);
            console.log("post: " + post);
            res.render('post.ejs', {post: post, currentUser: req.user});
        }
    });
});

// add comment
app.post('/profile/:username/:id/addComment', (req,res) => {
    if (!req.isAuthenticated()){
        res.redirect('back');
        return;
    }

    var postUsername = req.params.username;
    var postid = req.params.id;
    
    var text = req.body.text;
    var date = datetime.toISOString().slice(0,10);
    var username = req.user.username;
    var userId = req.user._id;

    // new comment
    var newComment = new Comment({
        text: text,
        date: date,
        user: userId,
        username: username
    });

    User.findOne({username: postUsername}, (err, user) => {
        if (err) {
            console.log(err);
            return res.send("Error: " + err);
        }
        else{
            // add comment to post
            var post = user.posts.find(post => post._id == postid);
            post.comments.push(newComment);

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

// delete comment
app.delete('/profile/:username/:id/:commentid', (req,res) => {
    if (!req.isAuthenticated()){
        res.redirect('back');
        return;
    }

    var postUsername = req.params.username;
    var postid = req.params.id;
    var commentid = req.params.commentid;

    User.findOne({username: postUsername}, (err, user) => {
        if (err) {
            console.log(err);
            return res.send("Error: " + err);
        }
        else{
            // find post
            var post = user.posts.find(post => post._id == postid);
            // find comment
            var comment = post.comments.find(comment => comment._id == commentid);

            // check if current user is the owner of the comment or owner of the post
            if (comment.username != req.user.username && post.username != req.user.username){
                return res.send("Error: You are not the owner of this comment");
            }

            // remove comment from post
            post.comments.remove(comment);

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
        return "failLength";
    }

    //check no special characters
    var regex = /^[a-zA-Z0-9_]+$/;
    if(!regex.test(username)){
        return "failCharacter";
    }

    return "success";
}

// login
app.post('/dosignin', passport.authenticate('local', {
    failureRedirect: '/login#fail',
    }), (req, res) => {
        console.log(req.user.username + " Logged in");

        // update all posts to have the current user's username
        User.findOne({username: req.user.username}, (err, user) => {
            if (err) {
                console.log(err);
                return res.send("Error: " + err);
            }
            else{
                //update all of this user's posts
                for (var i = 0; i < user.posts.length; i++){
                    //update username
                    user.posts[i].username = user.username;
                }
                //save user
                user.save();
            }
        });

        // find all users, update all posts's comments to have the current user's username
        User.find({}, (err, users) => {
            if (err) {
                console.log(err);
                return res.send("Error: " + err);
            }
            else{
                for (var i = 0; i < users.length; i++){
                    console.log("updating comments for " + users[i].username);
                    for (var j = 0; j < users[i].posts.length; j++){
                        console.log("- post " + j);
                        //update username
                        users[i].posts[j].comments.forEach(comment => {
                            console.log("-- comment " + comment.user + " to " + req.user._id);
                            if (comment.user.toString() == req.user._id.toString()){
                                console.log("---- updating comment username");
                                comment.username = req.user.username;
                            }
                        });
                    }
                    //save user
                    users[i].save();
                }
            }
        });

        res.redirect('/profile');
});

//create new user
app.post('/dosignup',(req,res) => {
    var username = req.body.username;
    var password = req.body.password;
    var confrimpassword = req.body.confirmpassword;

    if (password != confrimpassword){
        return res.redirect('/newuser#failMatch');
    }

    var ValidateUsernameResult = ValidateUsername(username);
    if (ValidateUsernameResult != "success"){
        return res.redirect('/newuser#' + ValidateUsernameResult);
    }

    console.log("Creating new user " + username);

    var newUser = new User({
        username: username
    });

    //dont save password, save hashed password
    User.register(newUser, password, (err, user) => {
        if(err){
            console.log(err);
            return res.redirect("/newuser#failExists");
        }
        else{
            passport.authenticate('local')(req, res, () => {
                res.redirect('/');
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

function isValidURL(string) {
    var res = string.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g);
    return (res !== null)
  };

app.listen(process.env.PORT || PORT, process.env.IP, () => console.log(`Server Running at port ${PORT}`));