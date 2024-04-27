var express = require("express");
var router = express.Router();
const passport = require("passport");
const localStrategy = require("passport-local");
const userModel = require("../models/users.models.js");
const postModel = require("../models/posts.models.js");
const storyModel = require("../models/story.models.js");
passport.use(new localStrategy(userModel.authenticate()))
const upload = require("./multer.js");
const utils = require("../utils/utils.js");


passport.use(new localStrategy(userModel.authenticate()))

// GET
router.get("/", (req, res)=>{
  res.render("index", { footer: false });
});

router.get("/login", (req, res)=>{
  res.render("login", { footer: false });
});

router.get("/feed", isLoggedIn, async function (req, res) {
  try {
    // Find the current user
    let user = await userModel.findOne({ username: req.session.passport.user }).populate("posts");

    // Find stories from other users
    let stories = await storyModel.find({ user: { $ne: user._id } }).populate("user");

    // Filter out duplicate stories
    let uniq = {};
    let filteredStories = stories.filter(item => {
      if (!uniq[item.user.id]) {
        uniq[item.user.id] = true;
        return true;
      } else {
        return false;
      }
    });

    // Find all posts
    let posts = await postModel.find().populate("user");

    // Render the feed page with user, posts, and filtered stories
    res.render("feed", {
      footer: true,
      user,
      posts,
      stories: filteredStories,
      dater: utils.formatRelativeTime,
    });
  } catch (error) {
    // Handle any errors
    console.error("Error fetching feed:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Define a route for viewing user stories
router.get("/story/:id", isLoggedIn, async function (req, res) {
  try {
    const storyId = req.params.id;
    const story = await storyModel.findById(storyId).populate("user");

    if (!story) {
      return res.status(404).send("Story not found");
    }

    res.redirect("/story", { story });
  } catch (error) {
    console.error("Error fetching story:", error);
    res.status(500).send("Internal Server Error");
  }
});





router.get("/profile", isLoggedIn, async function (req, res) {
  let user = await userModel
    .findOne({ username: req.session.passport.user })
    .populate("posts")
    .populate("saved");
  console.log(user);

  res.render("profile", { footer: true, user });
});

router.get("/profile/:user", isLoggedIn, async function (req, res) {
  try {
    let user = await userModel.findOne({ username: req.session.passport.user });

    if (user.username === req.params.user) {
      res.redirect("/profile");
    }

    let userprofile = await userModel
      .findOne({ username: req.params.user })
      .populate("posts")
      .populate("followers"); // Populate followers here

    res.render("userprofile", { footer: true, userprofile, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while fetching the user profile." });
  }
});

router.get("/follow/:userid", isLoggedIn, async function (req, res) {
  let followKarneWaala = await userModel.findOne({
    username: req.session.passport.user,
  });

  let followHoneWaala = await userModel.findOne({ _id: req.params.userid });

  if (followKarneWaala.following.indexOf(followHoneWaala._id) !== -1) {
    let index = followKarneWaala.following.indexOf(followHoneWaala._id);
    followKarneWaala.following.splice(index, 1);

    let index2 = followHoneWaala.followers.indexOf(followKarneWaala._id);
    followHoneWaala.followers.splice(index2, 1);
  } else {
    followHoneWaala.followers.push(followKarneWaala._id);
    followKarneWaala.following.push(followHoneWaala._id);
  }

  await followHoneWaala.save();
  await followKarneWaala.save();

  res.redirect("back");
});


router.get("/search", isLoggedIn, async function (req, res) {
  let user = await userModel.find({ username: req.session.passport.user });
  res.render("search", { footer: true, user });
});

router.get("/search/:username", async function (req, res) {
  try {
    const regex = new RegExp(`^(${req.params.username})`, 'i');
    const users = await userModel.find({ username: regex });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while searching for users." });
  }
});



router.post(
  "/post",
  isLoggedIn,
  upload.single("image"),
  async function (req, res) {
    const user = await userModel.findOne({
      username: req.session.passport.user,
    });

    if (req.body.category === "post") {
      const post = await postModel.create({
        user: user._id,
        caption: req.body.caption,
        picture: req.file.filename,
      });
      user.posts.push(post._id);
    } 
    await user.save();
    res.redirect("/feed");
  }
);

router.post("/delete-post/:postId", isLoggedIn, async function (req, res) {
  try {
    const postId = req.params.postId;
    const user = await userModel.findOne({ username: req.session.passport.user });

    // Remove the post from the user's posts array
    user.posts.pull(postId);
    await user.save();

    // Delete the post from the posts collection
    await postModel.findByIdAndDelete(postId);

    res.redirect("/profile"); // Redirect back to the profile page
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while deleting the post.");
  }
});
router.get("/like/:postid", async function (req, res) {
  const post = await postModel.findOne({ _id: req.params.postid });
  const user = await userModel.findOne({ username: req.session.passport.user });
  if (post.like.indexOf(user._id) === -1) {
    post.like.push(user._id);
  } else {
    post.like.splice(post.like.indexOf(user._id), 1);
  }
  await post.save();
  res.json(post);
});




router.get("/edit", isLoggedIn, async (req, res) => {
  try {
    const user = await userModel.findOne({ username: req.session.passport.user });
    res.render("edit", { user: user, footer: true });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});


router.get("/upload", isLoggedIn, async function (req, res) {
  let user = await userModel.findOne({ username: req.session.passport.user });
  res.render("upload", { footer: true, user });
});


router.post("/register", (req, res) => {
  const userData = new userModel({
    username: req.body.username,
    name: req.body.name,
    email: req.body.email,
  });

  userModel.register(userData, req.body.password, (err, user) => {
    if (err) {
      console.error(err);
      // Handle registration error, maybe return an error response
    } else {
      passport.authenticate("local")(req, res, () => {
        res.redirect("/profile");
      });
    }
  });
});

router.post("/login",passport.authenticate("local",{
  successRedirect: "/profile",
  failureRedirect:"/login"

}),(req,res)=>{

})

router.get("/logout",(req,res, next)=>{
   req.logout((err)=>{
    if(err) {
       return next(err)
    }
    res.redirect("/")
   })
})
router.post("/update", isLoggedIn, upload.single('image'), async (req, res) => {
  try {
    const updatedFields = {
      username: req.body.username,
      name: req.body.name,
      bio: req.body.bio
    };

    if (req.file) {
      updatedFields.profileImage = req.file.filename;
    }

    const user = await userModel.findOneAndUpdate(
      { username: req.session.passport.user },
      updatedFields,
      { new: true }
    );

    req.login(user, function (err) {
      if (err) throw err;
      res.redirect("/profile");
    });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

router.post("/upload",isLoggedIn,upload.single("image"),async(req,res)=>{
  try {
    const user = await userModel.findOne({ username: req.session.passport.user });
   const postData =  await postModel.create({
      picture: req.file.filename,
      user: user._id,
      caption: req.body.caption,

    })
    user.posts.push(postData._id)
    await user.save()
    res.redirect("/feed")
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
})



function isLoggedIn(req,res,next){
  if(req.isAuthenticated()) return next()
  res.redirect("/login")
}

module.exports = router;
