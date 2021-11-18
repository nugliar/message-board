'use strict';
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true});

const threadSchema = mongoose.Schema({
  board: String,
  text: String,
  delete_password: String,
  created_on: Date,
  bumped_on: Date,
  replies: { type: [{ type: mongoose.ObjectId }], default: [] },
  replycount: { type: Number, default: 0 },
  parent: mongoose.ObjectId,
  reported: { type: Boolean, default: false }
});
const ThreadModel = mongoose.model('Thread', threadSchema);

module.exports = function (app) {

  app.route('/api/threads/:board')

    .get(async (req, res) => {
      const board = req.params.board;
      const docs = await ThreadModel.find({
        board: board,
        parent: {$exists: false}
      })
        .select({ reported: 0, deletePassword: 0, __v: 0 })
        .sort({ bumped_on: 'desc' })
        .limit(10)
        .exec();

      const threads = await Promise.all(docs.map(async doc => {
        const thread = doc.toObject();

        thread.replies = await ThreadModel.find({ parent: doc._id })
          .select({ reported: 0, deletePassword: 0, __v: 0 })
          .sort({ bumped_on: 'desc' })
          .limit(3)
          .exec();

        return thread;
      }));

      res.json(threads);
    })

    .post(async (req, res) => {
      const board = req.params.board || req.body.board;
      const text = req.body.text;
      const delete_password = req.body.delete_password;
      const date = new Date();
      const doc = await ThreadModel.create({
        board: board,
        text: text,
        created_on: date,
        bumped_on: date,
        delete_password: bcrypt.hashSync(delete_password, 10),
      });

      res.redirect(`/b/${board}/`);
    })

    .put(async (req, res) => {
      const threadId = req.body.report_id;
      const doc = await ThreadModel.findById(threadId).exec();

      if (doc) {
        await ThreadModel.updateOne({_id: doc._id}, {reported: true}).exec();
      }
      res.send('success');
    })

    .delete(async (req, res) => {
      const threadId = req.body.thread_id;
      const deletePassword = req.body.delete_password;

      const doc = await ThreadModel.findById(threadId).exec();
      const hash = doc ? doc.delete_password : null;

      if (hash && bcrypt.compareSync(deletePassword, hash)) {
        await ThreadModel.deleteOne({_id: doc._id}).exec();
        res.send('success');
      } else {
        res.send('incorrect password');
      }
    });

  app.route('/api/replies/:board')

    .get(async (req, res) => {
      const board = req.params.board;
      const threadId = req.query.thread_id;

      const doc = await ThreadModel.findById(threadId).exec();
      const thread = doc.toObject();

      thread.replies = await Promise.all(thread.replies.map(id => {
        return ThreadModel.findById(id)
          .select({ reported: 0, deletePassword: 0, __v: 0 })
          .exec();
      }));

      res.json(thread);
    })

    .post(async (req, res) => {
      const board = req.params.board;
      const threadId = req.body.thread_id;
      const text = req.body.text;
      const delete_password = req.body.delete_password;
      const date = new Date();

      const threadQuery = ThreadModel.findById(threadId).exec();
      const replyQuery = ThreadModel.create({
        board: board,
        text: text,
        replies: [],
        created_on: date,
        bumped_on: date,
        delete_password: bcrypt.hashSync(delete_password, 10),
        parent: threadId
      });

      const threadDoc = await threadQuery;
      const replyDoc = await replyQuery;

      threadDoc.replies.push(replyDoc._id);
      threadDoc.replycount = threadDoc.replies.length;
      threadDoc.bumped_on = new Date();

      const doc = await threadDoc.save();

      res.redirect(`/b/${board}/${threadDoc._id}/`);
    })

    .put(async (req, res) => {
      const threadId = req.body.thread_id;
      const replyId = req.body.reply_id;

      const doc = await ThreadModel.findById(replyId).exec();

      if (doc) {
        await ThreadModel.updateOne({_id: doc._id}, {reported: true}).exec();
      }
      res.send('success');
    })

    .delete(async (req, res) => {
      const threadId = req.body.thread_id;
      const replyId = req.body.reply_id;
      const deletePassword = req.body.delete_password;

      const doc = await ThreadModel.findById(replyId).exec();
      const hash = doc ? doc.delete_password : null;

      if (hash && bcrypt.compareSync(deletePassword, hash)) {
        await ThreadModel.updateOne({_id: doc._id}, {text: '[deleted]'}).exec();
        res.send('success');
      } else {
        res.send('incorrect password');
      }
    });

    app.route('/_api/delete-all-threads')
      .get(async (req, res) => {
        const result = await ThreadModel.deleteMany({}).exec();
        res.json(result);
      })
};
