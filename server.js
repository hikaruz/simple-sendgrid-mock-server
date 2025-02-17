const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");

const apiKey = process.env.SENDGRID_API_KEY || "secret";
const fetchLimit = parseInt(process.env.SENDGRID_FETCH_LIMIT) || 10

const app = express();
app.set("view engine", "pug");

const store = [];

app.use(
  bodyParser.urlencoded({
    extended: false
  })
);
app.use(bodyParser.json());

app.use(
  session({
    secret: process.env.SESSION_COOKIE_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxage: 1000 * 60 * 30
    }
  })
);

app.get("/", function (req, res) {
  if (!req.session.user) {
    res.render("login");
    return;
  }
  res.render("index", {
    data: store
  });
});

app.get("/json", function (req, res) {
  const token = req.query.token;
  if (token != apiKey) {
    res.status(401).send("Unauthorized");
    return;
  }
  res.send(store);
});

app.post("/", function (req, res) {
  if (req.body.apikey != apiKey) {
    res.render("login", {
      error: "Failed login"
    });
    return;
  }
  req.session.user = { };
  res.redirect(302, "/");
});

app.post("/v3/mail/send", function (req, res) {
  // TODO: check auth
  const { content, ...message } = req.body;
  message.sent_at = Date.now();
  // separate personalizations
  const messages = message.personalizations.map(
    ({ substitutions = { }, ...personalization }) => {
      return {
        ...message,
        content: content.map(c => {
          if (!c.value) return c;
          return {
            ...c,
            // resolve substitutions
            value: Object.keys(substitutions).reduce((value, key) => {
              return value.split(key).join(substitutions[key]);
            }, c.value)
          };
        }),
        personalizations: [personalization],
        attachments: message?.attachments ??[]
      };
    }
  );
  store.unshift(...messages);
  store.splice(fetchLimit);
  res.status(202).end();
});

const port = process.env.PORT || 3030;
app.listen(port, function () {
  console.log(`start app (port: ${port})`);
});
