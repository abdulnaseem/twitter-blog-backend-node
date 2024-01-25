const express = require('express')
const User = require('../models/UserSchema')
const Post = require('../models/PostSchema')
const Reply = require('../models/ReplySchema')
const router = new express.Router()
const auth = require('../middleware/auth')
const producerRun = require('../../kafka/kafka-producer')
const startConsumer = require('../../kafka/kafka-consumer')


router.post('/api/v1.0/tweets/:username/add', auth, async (req, res) => {

    try {
        if(req.params.username !== req.user.loginId) {
            throw new Error('Error', 'Username does not exist!')
        }

        const user = await User.findById(req.user._id).select('-password');

        const newTweet = new Post({
            createdBy: user.loginId,
            content: req.body.content,
            owner: req.user.id
        }) 

        const tweet = await newTweet.save()
        res.json(tweet);
    } catch(e) {
        res.status(404).send(e)
    }
})

router.get('/api/v1.0/tweets/all', auth, async (req, res) => {
    try {
        const tweets = await Post.find().sort({ date: -1 });

        // producerRun(tweets).then(() => {
        //     startConsumer()
        // })

        res.json(tweets)
    } catch(e) {
        res.status(500).send()
    }
})

router.get('/api/v1.0/tweets/:username', auth, async (req, res) => {
    try {
        const tweet = await Post.find({ createdBy: req.params.username }).sort({ date: -1 });

        if(!tweet) {
            res.status(404).send()
        }

        // producerRun(tweet).then(() => {
        //     startConsumer()
        // })

        res.send(tweet)
    } catch(e) {
        res.status(500).send()
    }
})

router.get('/api/v1.0/tweets/discussion/:id', auth, async (req, res) => {
    try {
      const tweet = await Post.findById(req.params.id).sort({ date: -1 });

      if(!tweet) {
        res.send(404).json()
      }

      res.json(tweet);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
})

router.put('/api/v1.0/tweets/:username/update/:id', auth, async (req, res) => {
    const updates = Object.keys(req.body)
    const allowedUpdates = ['content']
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update))

    if (!isValidOperation) {
        return res.status(400).send({ error: 'Invalid updates!' })
    }

    try {
        const tweet = await Post.findOne({ _id:req.params.id })

        if (!tweet) {
            return res.status(404).send()
        }

        updates.forEach((update) => tweet[update] = req.body[update])
        await tweet.save()

        // producerRun(tweet).then(() => {
        //     startConsumer()
        // })

        res.send(tweet)
    } catch (e) {
        res.status(400).send(e)
    }
})

router.delete('/api/v1.0/tweets/:username/delete/:postId', auth, async (req, res) => {
    try {
        const tweet = await Post.findOneAndDelete({ _id: req.params.postId, createdBy: req.params.username })

        if(!tweet){
            res.status(404).send()
        }

        if(tweet.owner.toString() !== req.user.id) {
          return res.status(401).json({ msg: 'User not authorized' });
        }

        // // producerRun(tweet).then(() => {
        // //     startConsumer()
        // // })

        res.json({ msg: 'Tweet removed' });
    
    } catch(e) {
        res.status(500).send()
    }

})

// router.put('/api/v1.0/tweets/:username/like/:id', auth, async (req, res) => {
//     const _username = req.params.username
//     const _postId = req.params.id
//     const _id = req.user.id

//     const isLiked = req.user.likes && req.user.likes.includes(_postId);

//     const option = isLiked ? "$pull" : "$addToSet";
 
//     // Insert user like
//     req.user = await User.findByIdAndUpdate(_id, { [option]: { likes: _postId } }, { new: true})
//     .catch(error => {
//         console.log(error);
//         res.sendStatus(400);
//     })

//     // Insert post like
//     const post = await Post.findByIdAndUpdate(_postId, { [option]: { likes: _id } }, { new: true})
//     .catch(error => {
//         console.log(error);
//         res.sendStatus(400);
//     })

//     producerRun(post).then(() => {
//         startConsumer()
//     })

//     res.status(200).send(post)

// })

router.put('/api/v1.0/tweets/:username/like/:id', auth, async (req, res) => {
    const _postId = req.params.id
    const _id = req.user.id

    try {
        const post = await Post.findByIdAndUpdate(_postId, { $push: { likes: _id } }, { new: true})
        await post.save()
       // res.status(200).json(post)
        return res.json(post.likes)
    } catch(e) {
        res.status(400).send(e)
    }
})

router.put('/api/v1.0/tweets/:username/unlike/:id', auth, async (req, res) => {
    const _postId = req.params.id
    const _id = req.user.id

    try {
        const post = await Post.findByIdAndUpdate(_postId, { $pull: { likes: _id } }, { new: true})
        await post.save()
        //res.status(200).json(post)
        return res.json(post.likes)
    } catch(e) {
        res.status(400).send(e)
    }
})


router.put('/api/v1.0/tweets/:username/reply/:id', auth, async (req, res) => {
    const _username = req.params.username
    const _postParamsId = req.params.id 

    try {

        const user = await User.findOne({ loginId: _username })

        if(!user) {
            throw new Error()
        }

        const _postId = await Post.findOne({ _id: _postParamsId })
    
        if(!_postId) {
            return res.status(404).send()
        }
        const tweet = new Reply({
            postId: _postId,
            repliedBy: _username,
            ...req.body
        })

        await tweet.save()

        const post = await Post.findByIdAndUpdate({_id:req.params.id }, {replyTo: tweet})
        
        // producerRun(post).then(() => {
        //     startConsumer()
        // })

        res.status(201).send(post)
    } catch(e) {
        res.status(400).send(e)
    }

})

router.post('/api/v1.0/tweets/reply/:postId', auth, async (req, res) => {
  
      try {
        const user = await User.findById(req.user.id).select('-password');
        const tweet = await Post.findById(req.params.postId);

        console.log(user)
        console.log('')
        // console.log(tweet)

        if(!tweet) {
            res.status(404).end('error: post not found')
        }
  
        const newTweet = {
            createdBy: user.loginId,
            content: req.body.content,
            owner: user.id
        };
  
        tweet.comments.unshift(newTweet);

        //console.log('2: ' + tweet)

        await tweet.save();
        
        res.json(tweet.comments);
      } catch (err) {
        console.error(err.message);
        console.error(err.content);
        res.status(500).send('Server Error');
      }
    }
  );

  router.delete('/api/v1.0/tweets/:postId/delete/:replyId', auth, async (req, res) => {
    try {
      const tweet = await Post.findById(req.params.postId);
  
      // Pull out comment
      const reply = tweet.comments.find(
        (reply) => reply._id === req.params.replyId
      );
      // Make sure comment exists
      if (!reply) {
        return res.status(404).json({ msg: 'Comment does not exist' });
      }
      // Check user
      if (reply.owner.toString() !== req.user.id) {
        return res.status(401).json({ msg: 'User not authorized' });
      }
  
      tweet.comments = tweet.comments.filter(
        ({ _id }) => _id !== req.params.replyId
      );
  
      await tweet.save();
  
      return res.json(tweet.comments);
    } catch (err) {
      console.error(err.message);
      return res.status(500).send('Server Error');
    }
  });

module.exports = router
