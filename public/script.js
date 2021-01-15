$(document).ready(function () {
    var socket = io();
    socket.on('connect', function (socket) {
        console.log('Connected to Server');
    });

    //emit logged in user
    var ObjectID = $('#ObjectID').val();
    var carID = $('#carID').val();
    socket.emit('ObjectID', {
        carID: carID,
        userID: ObjectID
    });
    socket.on('car', function (car) {
        console.log(car);
        $.ajax({
            url: `https://maps.googleapis.com/maps/api/geocode/json?address=${car.location}&key=AIzaSyC4ElZo35x5fMZUw2MkgqWpCkoN8AELyig`,
            type: 'POST',
            data: JSON,
            processData: true,
            success: function (data) {
                console.log(data);
                socket.emit('LatLng', {
                    data : data,
                    car: car
                });
            }
        });
    });



    socket.on('disconnect', function (socket) {
        console.log('Disconnected to Server');
    });

});