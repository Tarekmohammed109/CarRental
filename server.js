//load modules
const express = require('express');
const exphbs = require('express-handlebars');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const formidable = require('formidable');
const socketIO = require('socket.io');
const http = require('http');

//const Handlebars = require('handlebars')
//const { allowInsecurePrototypeAccess } = require('@handlebars/allow-prototype-access')

//init app
const app = express();


//setup body pareser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// configuration for authentication
app.use(cookieParser());
app.use(session({
    secret: 'mysecret',
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
//load helpers
const { requireLogin, ensureGuest } = require('./helpers/authHelper');
const { upload } = require('./helpers/aws');
//load passports
require('./passport/local');
//require('./passport/facebook');
//make a user global
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

// load files
const keys = require('./config/keys');
//load stripe
const stripe = require('stripe')(keys.StripeSecretKey);
//load collection
const User = require('./models/user');
const Contact = require('./models/contact');
const Car = require('./models/car');
const { compareSync } = require('bcryptjs');
const user = require('./models/user');
const { use } = require('passport');
const { title } = require('process');
const { Socket } = require('net');
const Budget = require('./models/budget');
// connect to mongoDB
mongoose.connect(keys.MongoDB, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => {
        console.log('MongoDB is connected ..');
    }).catch((err) => {
        console.log(err);
    });

// setup view engine
//const handlebars = exphbs.create({
//    defaultLayout: 'main',
//    extname: 'handlebars',
//    handlebars: allowInsecurePrototypeAccess(Handlebars)
//});

app.engine(
    "handlebars",
    exphbs({
        defaultLayout: "main",
        runtimeOptions: {
            allowProtoPropertiesByDefault: true,
            allowProtoMethodsByDefault: true,
        },
    })
);
app.set("view engine", "handlebars");
// setup view end
//setup view
// app.engine('handlebars', exphbs({
//     defaultLayout: 'main'
// }));
// app.set('view engine', 'handlebars');
// connect client side to serve css and js files
app.use(express.static(__dirname + '/public'));
//creat port
const port = process.env.PORT || 8080;
//handle
app.get('/', ensureGuest, (req, res) => {
    res.render('home');
});
app.get('/about', (req, res) => {
    res.render('about', {
        title: 'About'
    });
});
app.get('/contact', requireLogin, (req, res) => {
    res.render('contact', {
        title: 'Contact Us'
    });
});
// save contact form data
app.post('/contact', requireLogin, (req, res) => {
    console.log(req.body);
    const newContact = {
        name: req.user._id,
        message: req.body.message
    }
    new Contact(newContact).save((err, User) => {
        if (err) {
            throw err;
        } else {
            console.log('We received message from user', User);
        }
    });

});
app.get('/signup', ensureGuest, (req, res) => {
    res.render('signupForm', {
        title: 'Register'
    });
});
app.post('/signup', ensureGuest, (req, res) => {
    console.log(req.body);
    let errors = [];
    if (req.body.password !== req.body.password2) {
        errors.push({ text: 'Password doesnot match' });
    }

    if (req.body.password.length < 8) {
        errors.push({ text: 'Password must be atleast 8 characters!' });
    }

    if (errors.length > 0) {
        res.render('signupForm', {
            errors: errors,
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            password: req.body.password,
            password2: req.body.password2,
            email: req.body.email
        })
    } else {
        User.findOne({ email: req.body.email })
            .then((user) => {
                if (user) {
                    let errors = [];
                    errors.push({ text: 'Email already exist' });
                    res.render('signupForm', {
                        errors: errors,
                        firstname: req.body.firstname,
                        lastname: req.body.lastname,
                        password: req.body.password,
                        password2: req.body.password2,
                        email: req.body.email
                    });
                } else {
                    let salt = bcrypt.genSaltSync(10);
                    let hash = bcrypt.hashSync(req.body.password, salt);

                    const newUser = {
                        firstname: req.body.firstname,
                        lastname: req.body.lastname,
                        email: req.body.email,
                        password: hash
                    }
                    new User(newUser).save((err, user) => {
                        if (err) {
                            throw err;
                        }
                        if (user) {
                            let success = [];
                            success.push({ text: 'Your account has been created successfully' });
                            res.render('LoginForm', {
                                success: success

                            })
                        }
                    })
                }
            })
    }


});
app.get('/displayLoginForm', ensureGuest, (req, res) => {
    res.render('LoginForm', {
        title: 'Login'
    });
});
 app.post('/login', passport.authenticate('local', {
     successRedirect: '/profile',
     failureRedirect: '/loginErrors'
 }));

// app.post('/login', function (req, res, next) {
//     passport.authenticate('local', function (err, user, info) {
//         if (err) { return next(err); }
//         // Redirect if it fails
//         if (!user) { return res.redirect('/loginErrors'); }
//         req.login(user, function (err) {
//             if (err) { return next(err); }
//             // Redirect if it succeeds
//             return res.redirect('/profile');
//         });
//     })(req, res, next);
// });



// //Facebook login Auth
// app.get('/auth/facebook', passport.authenticate('facebook', {
//     scope: ['email']

// }));
// app.get('/auth/facebook/callback', passport.authenticate('facebook', {
//     successRedirect: '/profile',
//     failureRedirect: '/'
// }));

//Display Profile
app.get('/profile', requireLogin, (req, res) => {
    User.findById({ _id: req.user._id })
        .then((user) => {
            user.online = true;
            user.save((err, user) => {
                if (err) {
                    throw err;
                }
                if (user) {
                    res.render('profile', {
                        user: user,
                        title: 'Profile'

                    });
                }
            });
        });
});
app.get('/loginErrors', (req, res) => {
    let errors = [];
    errors.push({ text: 'User Not found or Password incorrect' });
    res.render('LoginForm', {
        errors: errors,
        title: 'Error'
    });
});
//List a car route
app.get('/listcar', requireLogin, (req, res) => {
    res.render('listCar', {
        title: 'Listing Car'
    });
});
app.post('/listCar', requireLogin, (req, res) => {
    const newCar = {
        owner: req.user._id,
        make: req.body.make,
        model: req.body.model,
        year: req.body.year,
        type: req.body.type,
    }
    new Car(newCar).save((err, car) => {
        if (err) {
            throw err;
        }
        if (car) {
            res.render('listCar2', {
                title: 'Finish',
                car: car
            });
        }
    });
});
app.post('/listCar2', requireLogin, (req, res) => {
    Car.findOne({ _id: req.body.carID, owner: req.user._id })
        .then((car) => {
            let imageUrl = {
                imageUrl: `https://car-rental-ap.s3.amazonaws.com/${req.body.image}`
            }
            car.pricePerHour = req.body.pricePerHour;
            car.pricePerWeek = req.body.pricePerWeek;
            car.location = req.body.location;
            car.image.push(imageUrl);
            car.picture = `https://car-rental-ap.s3.amazonaws.com/${req.body.image}`;
            car.save((err, car) => {
                if (err) {
                    throw err;
                }
                if (car) {
                    res.redirect('/showCars');
                }
            })
        });
});
app.get('/showCars', requireLogin, (req, res) => {
    Car.find({})
        .populate('owner')
        .sort({ date: 'desc' })
        .then((cars) => {
            res.render('showCars', {
                cars: cars
            });
        });
});
//receive image
app.post('/uploadImage', requireLogin, upload.any(), (req, res) => {
    const form = new formidable.IncomingForm();
    form.on('file', (field, file) => {
        console.log(file);
    });
    form.on('error', (err) => {
        console.log(err);
    });
    form.on('end', () => {
        console.log('Image received successfully');
    });
    form.parse(req);
});
//logout functionality
app.get('/logout', (req, res) => {
    User.findById({ _id: req.user._id })
        .then((user) => {
            user.online = false;
            user.save((err, user) => {
                if (err) {
                    throw err;
                }
                if (user) {
                    req.logOut();
                    res.redirect('/');
                }
            });
        });
});
app.get('/openGoogleMap', (req, res) => {
    res.render('googlemap');
});
//display car
app.get('/displayCar/:id', (req, res) => {
    Car.findOne({ _id: req.params.id }).then((car) => {
        res.render('displayCar', {
            car: car
        })
    }).catch((err) => { console.log(err) })
})
//create owner page
app.get('/contactOwner/:id', (req, res) => {
    User.findOne({ _id: req.params.id })
        .then((owner) => {
            res.render('ownerProfile', {
                owner: owner
            })
        }).catch((err) => { console.log(err) })
});
// renting car funtion
app.get('/RentCar/:id', (req, res) => {
    Car.findOne({ _id: req.params.id })
        .then((car) => {
            res.render('calculate', {
                car: car
            })
        }).catch((err) => { console.log(err) });
});
//calculate cost
app.post('/calculateTotal/:id', (req, res) => {
    Car.findOne({ _id: req.params.id })
        .then((car) => {
            console.log(req.body);
            //console.log('Type is', typeof(req.body.week));
            //console.log('Type is ', typeof(req.body.hour));
            var hour = parseInt(req.body.hour);
            var week = parseInt(req.body.week);
            var totalHours = hour * car.pricePerHour;
            var totalWeeks = week * car.pricePerWeek;
            var total = totalHours + totalWeeks;
            console.log('Total is', total);
            const budget = {
                carID: req.params.id,
                total: total,
                renter: req.user._id,
                date: new Date()
            }
            new Budget(budget).save((err, budget) => {
                if (err) {
                    console.log(err);
                }
                if (budget) {
                    Car.findOne({ _id: req.params.id })
                        .then((car) => {
                            //calaculate total for stripe
                            var stripTotal = budget.total * 100;
                            res.render('checkout', {
                                budget: budget,
                                car: car,
                                StripePublishableKey: keys.StripePublishableKey,
                                stripTotal: stripTotal
                            })
                        }).catch((err) => { console.log(err) });
                }
            })
        });
});
//Print Receipt
app.post('/chargeRental/:id', (req, res) => {
    Budget.findOne({ _id: req.params.id })
        .populate('renter')
        .then((budget) => {
            const amount = budget.total * 100;
            stripe.customers.create({
                email: req.body.stripeEmail,
                source: req.body.stripeToken
            })
                .then((customer) => {
                    stripe.charges.create({
                        amount: amount,
                        description: `$${budget.total} for renting a car`,
                        currency: 'usd',
                        customer: customer.id,
                        receipt_email: customer.email

                    }, (err, charges) => {
                        if (err) {
                            console.log(err);
                        }
                        if (charges) {
                            console.log(charges);
                            res.render('success', {
                                charges: charges,
                                budget: budget
                            })
                        }
                    })
                }).catch((err) => { console.log(err) })

        }).catch((err) => { console.log(err) });
})
// socket connection
const server = http.createServer(app);
const io = socketIO(server);
io.on('connection', (socket) => {
    console.log('Connected to Client');
    //LISTEN TO ID EVENT
    socket.on('ObjectID', (oneCar) => {
        console.log('One car is ', oneCar);
        Car.findOne({
            owner: oneCar.userID,
            _id: oneCar.carID
        })
            .then((car) => {
                socket.emit('car', car);
            });
    });
    //Find car and send them to browser
    Car.find({}).then((cars) => {
        socket.emit('allcars', { cars: cars });
    }).catch((err) => {
        console.log(err);
    })
    //
    socket.on('LatLng', (data) => {
        console.log(data);
        Car.findOne({ owner: data.car.owner })
            .then((car) => {
                car.coords.lat = data.data.results[0].geometry.location.lat;
                car.coords.lng = data.data.results[0].geometry.location.lng;
                car.save((err, car) => {
                    if (err) {
                        throw err;
                    }
                    if (car) {
                        console.log('Car lat and lng is updated');
                    }
                })
            }).catch((err) => {
                console.log(err);
            });
    });
    //Desconnect
    socket.on('disconnect', (socket) => {
        console.log('Disconnected to Client');
    });
});
server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

app.get("/sayHello", function (request, response) {
    var user_name = request.query.user_name;
    response.end("Hello " + user_name + "!");
});

require("cf-deployment-tracker-client").track();