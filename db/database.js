var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/db_app', {
	useNewUrlParser: true,
	useUnifiedTopology: true,
});

const CatsSchema = new mongoose.Schema({
    name: String,
    age: Number,
    color: String
});

var Cat = mongoose.model('Cat', CatsSchema);

function createCat(name, age, color) {
    var cat = new Cat({
        name: name,
        age: age,
        color: color
    });
    cat.save(function (err, cat) {
        if (err) return console.error(err);
        console.log(cat.name + " saved to cats collection.");
    });
}

createCat('Fluffy', 2, 'white');