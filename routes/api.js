'use strict';
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true});

const threadSchema = mongoose.Schema({
  board: String,
  text: String,
  passToDel: String,
  created_on: String,
  replies: [{ type: mongoose.ObjectId }],
  replycount: Number,
  parent: mongoose.ObjectId
});
const ThreadModel = mongoose.model('Thread', threadSchema);

module.exports = function (app) {

  app.route('/api/threads/:board')
    .get(async (req, res) => {
      const board = req.params.board;
      const docs = await ThreadModel.find({
        board: board,
        parent: {$exists: false}
      }).exec();

      const threads = docs.map(doc => doc.toObject());

      for (const thread of threads) {
        thread.replies = await Promise.all(thread.replies.map(id => {
          return ThreadModel.findById(id).exec();
        }))
      };

      res.json(threads);
    })
    .post(async (req, res) => {
      const board = req.params.board || req.body.board;
      const text = req.body.text;
      const delete_password = req.body.delete_password;

      const doc = await ThreadModel.create({
        board: board,
        text: text,
        replies: [],
        replycount: 0,
        created_on: new Date().toISOString(),
        delete_password: bcrypt.hashSync(delete_password, 10),
      });

      res.redirect(`/b/${board}/`);
    });

  app.route('/api/replies/:board')
    .get(async (req, res) => {
      const board = req.params.board;
      const threadId = req.query.thread_id;

      const doc = await ThreadModel.findById(threadId).exec();
      const thread = doc.toObject();

      thread.replies = await Promise.all(thread.replies.map(id => {
        return ThreadModel.findById(id).exec();
      }));

      res.json(thread);
    })
    .post(async (req, res) => {
      const board = req.params.board;
      const threadId = req.body.thread_id;
      const text = req.body.text;
      const delete_password = req.body.delete_password;

      const threadQuery = ThreadModel.findById(threadId).exec();
      const replyQuery = ThreadModel.create({
        board: board,
        text: text,
        replies: [],
        replycount: 0,
        created_on: new Date().toISOString(),
        delete_password: bcrypt.hashSync(delete_password, 10),
        parent: threadId
      });

      const threadDoc = await threadQuery;
      const replyDoc = await replyQuery;

      threadDoc.replies.push(replyDoc._id);
      threadDoc.replycount = (threadDoc.replycount || 0) + 1;

      const doc = await threadDoc.save();

      res.redirect(`/b/${board}/${threadDoc._id}/`);
    });

    app.route('/_api/delete-all-threads')
      .get(async (req, res) => {
        const result = await ThreadModel.deleteMany({}).exec();
        res.json(result);
      })
};
