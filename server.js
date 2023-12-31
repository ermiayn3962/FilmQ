/* importing the installed dependencies */
require('dotenv').config({path: __dirname + '/.env'});
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const passport = require('passport');
const flash = require('express-flash');
const session = require('express-session');
const methodOverride = require('method-override')
const path = require('path');
const cineSwipe = require('./api.js')
const PORT = process.env.PORT || 3000;

/* Connecting to database */
async function connect() {
    try {
        await mongoose.connect(process.env.URI, {dbName: 'CineSwipe'});
        console.log("Connected to MongoDB");
    } catch (error) {
        console.log(error);
    }
}

connect();
var db = mongoose.connection;

/* User Schema */
const userSchema = new mongoose.Schema({
    id : String,
    name : String,
    email : String,
    password : String,
    recs : [Number],
    watchlist : [Number]
})

const User = mongoose.model('User', userSchema);

/* Initialize passport */
const initializePassport = require('./passport-config.js');
initializePassport(
    passport, 
    async email => await User.findOne({email: email}),
    async id => await User.findOne({id: id})
);



/* Setting app uses */
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(flash());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use((req, res, next) => {
    res.locals.message = req.flash();
    next();
})
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride('_method'))
    
/* Post Routes */
app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
    successRedirect: '/homepage-intermediary',
    failureRedirect: '/login',
    failureFlash: true
}))


// Adding user information to database
app.post('/signup', checkNotAuthenticated, async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);

        const data = new User({
            id: parseFloat(Date.now().toString()),
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword,
            recs: [],
            watchlist: []
        })

        /* Checking if user already exists */
        user = await User.findOne({email : data.email});

        if (user == null) {

            db.collection('users').insertOne(data, (error, collection) => {
                if (error) {
                   console.log(error)
                } else {
                    console.log("User inserted to DB successfully");

                }
            });
        } else {
            req.flash('error', 'User already exists');
            
        }
        res.redirect('/login')
    } catch {
        res.redirect('/signup')
    }
})


/* Get Routes */
app.get('/', checkAuthenticated, async (req, res) => {
    let user = await req.user

    res.render('index', {data : user})
})

app.get('/homepage-intermediary', checkAuthenticated, async (req, res) => {
    let user = await req.user

    if (user.recs.length == 0) {
        res.redirect('/cineSwipe')
    } else {
        res.redirect('/')
    }
})

app.get('/login', checkNotAuthenticated, (req, res) => {
    if (res.locals.message) {
        res.render('login', {message: res.locals.message})
    } else {
        res.render('login')
    }
})

app.get('/signup', checkNotAuthenticated, (req, res) => {
    res.render('signup')
})
app.get('/cineSwipe', checkAuthenticated, async (req, res) => {
    let user = await req.user
    // console.log("data going to pass", JSON.stringify(user))
    res.render('cineSwipe', {data : user})
})

app.delete('/logout', (req, res) => {
    req.logOut((err) => {
        if (err) {
            console.log(err)
        } else {

            res.redirect('/login')
        }
    })
})


/* Functions */
function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next()
    }

    res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/')
    }
    
    next()
}

app.post('/api/updateUser', async (req, res) => {
    let user = await req.body
    console.log ("this is the param", user)
    console.log(user.email)

    await User.updateOne({email: user.email}, user)
    let updated_user = await User.findOne({email: user.email})
    res.send(updated_user)
})

app.listen(PORT, () => console.log("Server starting on port" + PORT))