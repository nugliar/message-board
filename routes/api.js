'use strict';

module.exports = function (app) {

  app.route('/api/threads/:board')
    .post((req, res) => {
      console.log(req.body);
    });

  app.route('/api/replies/:board');

};
