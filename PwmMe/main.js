// importerar alla nodejs modules
const express = require("express");
const session = require('express-session');
const { xss } = require('express-xss-sanitizer');
const request = express();
const path = require("path");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const favicon = require('serve-favicon');
const crypto = require("crypto");
const WebSocket = require('ws');


const cookieParser = require("cookie-parser");
const { count } = require("console");
const { connect } = require("http2");
const { json } = require("stream/consumers");
//

// mysql config
const sql = mysql.createPool({
    host: '127.0.0.1',
    user: 'user',
    password: 'password123',
    database: 'database',
    waitForConnections: true,
    enableKeepAlive: true, // skickar över keep alive packets till databasen
    connectionLimit: 50,      // kopplingar som är tillåtet
    idleTimeout: 60000,       // stäng kopplingar som är idle för en minut 
    queueLimit: 100,          // max tid där servern kan vänta på en koppling
    multipleStatements: true // tillåter transaction inom sql query
});
//

// funktion för att kunna få alla användarnas plats, poäng, flaggor och tid för leaderboard
async function getTopUsers(page) {
    offset = (page - 1) * 50;
    [leaderboard] = await sql.execute("SELECT username, success_flags, total_points, SUBSTRING_INDEX(SUBSTRING_INDEX(completion_time, 'T', -1), '.', 1) AS completion_time, RANK() OVER (ORDER BY total_points DESC) AS position FROM leaderboard WHERE role = ? AND account_status = ? ORDER BY total_points DESC LIMIT 50 OFFSET ?", ["user", "false", offset]);
    return leaderboard;
}
//

// funktion för att kunna få hur många sidor man kan bläddra igenom för leaderboard
async function getPages() {
    [user_count] = await sql.execute("SELECT COUNT(username) AS users FROM leaderboard WHERE role = ? AND account_status = ?", ["user", "false"]);
    users = user_count[0].users;
    let page_count = Math.ceil(users/50);
    return page_count;
}

// Map för Leaderboard websocker
const sseLeaderboardConnections = new Map();
//

// Map för användaren realtid updatering websocker
const sseUserConnections = new Map();

// Map för alla användare kopplat till realtid updatering websocker
const UsersConnected = new Map();


// Uppdatera alla användare cookies för att ta bort deras tid om en ny flagga skapas.
async function UserSSEUpdateFlagCreate() {
    try {
        // ändrar varje koppling inom websocket som tillhör sseUserConnections mappen
        for (const [connectionId, connectionData] of sseUserConnections) {
            try {
                // genererar en any jwt token för varende användare och anger värden som finns inom deras mapp förutom time som är null och expire
                const token = jwt.sign({ username: connectionData.username, role: connectionData.role, flags: connectionData.flags, time: null, account_status: connectionData.accountStatus}, connectionData.jwt_secret, { expiresIn: "1h" });
                connectionData.res.write(`data: ${JSON.stringify({token})}\n\n`); // skickar över jwt token till användaren med \n\n för att kunna processa den
            } catch (error) {
                console.error('Error writing to SSE connection:', error);
                sseUserConnections.delete(connectionId);
            }
        }
    } catch (error) {
        console.error('Error Flag Create SSE update:', error);
    }
}

// Uppdatera alla användarens websockets som är kopplat till hens användarnamn om hens konto blir regerad.
async function UserSSEUpdateUserEdit(user, role, flags, time, account_status) {
    if (UsersConnected.has(user)) {
        const UserSessionsList = UsersConnected.get(user);
        UserSessionsList.forEach(sessionId => {
        try {
            let UserConnections = sseUserConnections.get(sessionId);
            UserTimeSet = UserConnections.time;
            if (time === true) {
                UserTimeSet = null;
            }
            const token = jwt.sign({username: user, role: role, flags: flags, time: UserTimeSet, account_status: account_status}, UserConnections.jwt_secret, { expiresIn: "1h" });
            const connectionData = sseUserConnections.get(sessionId);
            connectionData.res.write(`data: ${JSON.stringify({token})}\n\n`);
        } catch (error) {
            console.error("Oops an error occurred: " + error)
            return sseUserConnections.delete(sessionId);
        }
    });
    } else {
        return
    }
}

// Funktion för att filterara en viss flagga från alla användaren 
async function UserSSEUpdate(flag) {
    try {
        for (const [connectionId, connectionData] of sseUserConnections) {
            try {
                let FlagList = connectionData.flags;
                const flags = FlagList.filter(FlagList => FlagList !== flag);
                const token = jwt.sign({ username: connectionData.username, role: connectionData.role, flags: flags, time: null, account_status: connectionData.accountStatus}, connectionData.jwt_secret, { expiresIn: "1h" });
                connectionData.res.write(`data: ${JSON.stringify({token})}\n\n`);
            } catch (error) {
                console.error('Error writing to SSE connection:', error);
                sseUserConnections.delete(connectionId);
            }
        }
    } catch (error) {
        console.error('Error broadcasting SSE update:', error);
    }
}

// Funktion för att uppdatera leaderboard i realtid
async function broadcastSSEUpdate() {
    try {
        for (const [connectionId, connectionData] of sseLeaderboardConnections) {
            try {
                const page = connectionData.query.page || 0;
                const users = await getTopUsers(page);
                const page_count = await getPages();
                connectionData.res.write(`data: ${JSON.stringify({users, page_count: page_count})}\n\n`);
            } catch (error) {
                console.error('Error writing to SSE connection:', error);
                sseLeaderboardConnections.delete(connectionId);
            }
        }
    } catch (error) {
        console.error('Error broadcasting SSE update:', error);
    }
}

// Middleware för att hålla koll på SSE kopplingar till leaderboard
const sseLeaderboardMiddleware = (req, res, next) => {
    const connectionId = [req.user.username, crypto.randomBytes(64).toString('hex')] // Genererar id åt användaren och nej chansen för att genererar two identiska random id är i praktist sätt 0
    sseLeaderboardConnections.set(connectionId, {
        res: res,
        query: req.query  // lägger till alla query parameters inom query
    });
    
    req.on('close', () => {
        sseLeaderboardConnections.delete(connectionId);
    });
    
    next();
};

// Middleware för att hålla koll på SSE kopplingar till användaren
const sseUserMiddleware = async (req, res, next) => {
    const connectionId = crypto.randomBytes(64).toString('hex') // Genererar id åt användaren och nej chansen för att genererar two identiska random id är i praktist sätt 0
    try {
        const [user_query] = await sql.execute("SELECT jwt_secret FROM users WHERE username = ?", [req.user.username]);
        if (UsersConnected.has(req.user.username)) { 
            let CurrentConnections = UsersConnected.get(req.user.username);
            CurrentConnections.push(connectionId);
            UsersConnected.set(req.user.username, CurrentConnections);
        } else {
            UsersConnected.set(req.user.username, [connectionId]);
        }
        sseUserConnections.set(connectionId, {
            res: res,
            username: req.user.username,
            role: req.user.role,
            flags: req.user.flags,
            time: req.user.time,
            accountStatus: req.user.account_status,
            jwt_secret: user_query[0].jwt_secret,
        });
    } catch (error) {
        console.error(error);
        sseUserConnections.delete(connectionId);
        CurrentConnections = UsersConnected.get(req.user.username);
        const ConnectionsListUpdated = CurrentConnections.filter(userConnectionid => userConnectionid !== connectionId);
        if (ConnectionsListUpdated.length > 0) {
            UsersConnected.set(req.user.username, ConnectionsListUpdated);
        } else {
            UsersConnected.delete(req.user.username);
        }
        return res.status(500).send("Oops en error occurred")
    }
    
    req.on('close', () => {
        sseUserConnections.delete(connectionId);
        CurrentConnections = UsersConnected.get(req.user.username);
        const ConnectionsListUpdated = CurrentConnections.filter(userConnectionid => userConnectionid !== connectionId);
        if (ConnectionsListUpdated.length > 0) {
            UsersConnected.set(req.user.username, ConnectionsListUpdated);
        } else {
            UsersConnected.delete(req.user.username);
        }
    });
    
    next();
};

//

// port att operera på
const port = 3000;

// lista på alla roles :)
const availableRoles = ["user", "moderator", "admin", "rickroll"];

// list på alla svårigheter
const flag_difficulties = ['easy', 'medium', 'hard', 'insane'];

// en variabel på antal flaggor som finns
let flag_count;

// använd cookieParser och express.json för varenda request
request.use(cookieParser());
request.use(express.json());

// om användaren skickar en dålig json request så skicka "Dåligt client request" tillbaka. annars krachar hela webbsidan
request.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).send("Dåligt client request");
    }
    next();
  });

// session token config
request.use(session({
    name: 'session_token',
    secret: '944699bae2c303439869fa089dd167f71bc5df8086d609b319253ce73f9b4a44d0dce56181b59b8c1ef26a213d066022c91c4fb51f0de6daf42665724e6a1c40',
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true, // the session token is not being used on the main menu so its pointless to have it set as 'false'
      maxAge: 3600000, // 1hr
    }
}));
//

// tillåt tillgång till alla filter inom mappen /js, /css och /images
request.use("/js", express.static(path.join(__dirname, "js")));
request.use("/css", express.static(path.join(__dirname, "css")));
request.use("/images", express.static(path.join(__dirname, "images")));

// favicon till webbsidan
request.use(favicon(path.join(__dirname, 'favicon.ico')));


// webbsidan alltid användren checkAuth på varenda request där url är inte "login.html", "/login", "/register", "/", "/register.html"
request.use((req, res, next) => {
    if (req.path === "/login.html" || req.path === "/login" || req.path === "/register" || req.path === "/" || req.path === "/register.html") {
        checkToken(req, res, next); // kallas en funktion som kollar om användaren redan har en token
    } else {
    checkAuth(req, res, next);
    }
});
//


// en funktion för att kolla om användarens roll är admin eller moderator för att kunna filterar alla vanlig användare role
async function mod_check(req, res, next) {
    if (req.user) {
        if (req.user.role === "admin" || req.user.role === "moderator") {
        next()
        } else {
            return res.redirect("/");
        }
    } else {
        return res.redirect("/");
    }
}

// en funktion för att kolla om användarens roll är admin för att kunna filterar mot moderator och vanlig användare role
async function admin_check(req, res, next) {
    if (req.user) {
        if (req.user.role === "admin") {
        next()
        } else {
            return res.redirect("/");
        }
    } else {
        return res.redirect("/");
    }
}

// en function för att kolla hur många flaggor det finns och sedan anger det till ett variabel för senare användning. Reducerar requests mellan sql server och minimerar delay
async function update_flag_count() {
    [flag_count_query] = await sql.execute("SELECT COUNT(name) AS count FROM flags");
    const count = flag_count_query[0].count 
    return flag_count = parseInt(count); // nödvänligt att använda ParseInt för att inte råka ange flag_count en string istället för en Intiger
}

update_flag_count(); // kallar på funktionen att se hur många flaggor det finns

// En funktion som kallas på för varenda giltigt flagga en användare har anget eller om de besöker /hacking.html
async function time_finish(req, res, next) {
    if (req.user.time === "null") { // behöver bekräfta om användaren har ingen tid
        try {
            
            const username = req.user.username; 
            const flags = req.user.flags; 
            const user_role = req.user.role;

            if (flags.length === flag_count) { // begöver också bekräfta om användaren har alla flaggor genom att jämnföra hur många flaggor användaren har med hur många flaggor som finns inom databasen
                
                await sql.execute("INSERT INTO users_finish (username) VALUES (?)", [username]);
                
                const [user_time] = await sql.execute("SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(time, 'T', -1), '.', 1) AS time FROM users_finish WHERE username = ?", [username]);

                if (user_time.length > 0) {

                    const [user_info] =  await sql.execute("SELECT username, jwt_secret, account_status FROM users WHERE username = ?", [username])

                    if (user_info.length > 0) {

                        user = user_info[0]
                        user_finish = user_time[0].time
                        
                        const token = jwt.sign({ username: username, role: user_role, flags: flags, time: user_finish, account_status: user.account_status}, user.jwt_secret, { expiresIn: "1h" }); // updaterar användarens token för att de skulle få deras tid direkt efter webbsidan har laddats
                        broadcastSSEUpdate();
                        res.cookie("token", token, { httpOnly: false });
                        next()

                    } else {
                        return res.redirect("/");
                    }

                } else {
                    return res.redirect("/");
                }
            } else {
                return next()
            }
            
        } catch (error) {
            console.error(error)
            return res.status(500).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.");
        }

    } else {
        return next()
    }
}

// en function för att verifiera om användaren har redan en cookie token
function checkToken(req, res, next) {
    try {
        const token = req.cookies?.token || req.headers["authorization"]?.split(" ")[1];

        if (token) {
            return res.redirect("/hacking.html"); // om den är giltigt skicka användaren över till /hacking.html som då kommer kolla om den är giltigt eller inte 
        } else {
            return next(); // om hen har inte det så skicka användaren vidare till vad den original url requesten var
        }
    } catch (error) {
        console.error(error)
        return res.status(500).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.")
    }
} 

// en funktion för att kunna kolla om användaren är inloggad och att deras token är giltigt
async function checkAuth(req, res, next) {
    try {
        const token = req.cookies?.token || req.headers["authorization"]?.split(" ")[1]; // tar deras token från token cookies eller authorization header

        if (token) {
            const decoded = jwt.decode(token); // decrypterar informationen inom token

            if (decoded?.username && decoded?.role) { // kollar om det finns role och användarnamn inom token
                // kollar om användarens role och användarnamn stämmer
                const [user_info] = await sql.execute("SELECT username, jwt_secret, account_status FROM users WHERE username = ? AND role = ?", [decoded.username, decoded.role]);

                if (user_info.length > 0) {
                    user = user_info[0]
                    jwt_secret = user.jwt_secret;

                    // verifierar användarens token genom att använda jwt.verify
                    jwt.verify(token, jwt_secret, (error, user) => {
                        // om det blir ett error med att verfiera jwt token så ta bort användarens token och skicka de över till /login.html
                        if (!error) {
                            
                            // kollar om session och användarnamn finns
                            if (req.session && req.session.user) {

                                // kollar om skapat jwt token anvädarnamn är samma som användarens användarnamn inom cookie token 
                                if (req.session.user === user.username) { 
                                    req.user = user;

                                    // om användarens konto är bannad 
                                    if (user.account_status !== "banned") {

                                        // kollar om användarens konto är spärrat
                                        if (user.account_status !== "suspended") {

                                            // för att kolla om användarens roll är david
                                            if (user.role !== "rickroll") {

                                                // om användaren är redan inom /account_banned.html eller /account_suspended.html fast även om deras konto är inte bannat eller spärrat så skicka användaren till /hacking.html
                                                if (req.path === "/account_banned.html" || req.path === "/account_suspended.html") {
                                                    return res.redirect("/hacking.html");
                                                }
                                                
                                                next();
                                            } else {
                                                return res.redirect("https://ia601509.us.archive.org/10/items/Rick_Astley_Never_Gonna_Give_You_Up/Rick_Astley_Never_Gonna_Give_You_Up.mp4");
                                            }

                                        } else {
                                            if (req.path === "/account_suspended.html" || "/logout") {
                                                return next();
                                            } else {
                                                return res.redirect("/account_suspended.html");
                                            }
                                        }
                
                                    } else {
                                        if (req.path === "/account_banned.html" || "/logout") {
                                            return next();
                                        } else {
                                            return res.redirect("/account_banned.html");
                                        }
                                    }
                                } else {
                                    res.clearCookie('session_token').clearCookie('token');
                                    return res.redirect("/login.html");
                                }

                            } else {
                                res.clearCookie('session_token').clearCookie('token');
                                return res.redirect("/login.html");
                            }

                        } else {
                            console.error('JWT verification error: ', error.message);
                            res.clearCookie('session_token').clearCookie('token');
                            return res.redirect("/login.html");
                        }
                    });

                } else {
                    res.clearCookie('session_token').clearCookie('token');
                    return res.redirect("/login.html");
                }

            } else {
                res.clearCookie('session_token').clearCookie('token');
                return res.redirect("/login.html");
            }

        } else {
            if (req.path === "/login.html") {
                return next();
            } else {
                return res.redirect("/login.html");
            }
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.")
    }
};
//

// användaren har tillgång till dessa webbsidor
request.get(`/account_banned.html`, (req, res) => {
    res.sendFile(path.join(__dirname, "/account_banned.html"));
});

request.get(`/account_suspended.html`, (req, res) => {
    res.sendFile(path.join(__dirname, "/account_suspended.html"));
});

request.get(`/change_password.html`, (req, res) => {
    res.sendFile(path.join(__dirname, "/change_password.html"));
});

request.get(`/register.html`, (req, res) => {
    res.sendFile(path.join(__dirname, "/register.html"));
});

request.get(`/`, (req, res) => {
    res.sendFile(path.join(__dirname, "/login.html"));
});

request.get("/login.html", (req, res) => {
    res.sendFile(path.join(__dirname, "/login.html"));
});

request.get(`/leaderboard.html`, (req, res) => {
    res.sendFile(path.join(__dirname, "/leaderboard.html"));
});
request.get(`/account.html`, (req, res) => {
    res.sendFile(path.join(__dirname, "/account.html"));
});

request.get('/leaderboard/stream', sseLeaderboardMiddleware, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Send initial data
    try {
        page = req.query.page
        const users = await getTopUsers(page);
        const page_count = await getPages()
        res.write(`data: ${JSON.stringify({users, page_count: page_count})}\n\n`);
    } catch (error) {
        console.error('Error sending initial SSE data:', error);
    }
});

request.get('/user/RealTimeUpdate', sseUserMiddleware, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
});

request.get("/logout", (req, res) => {
    res.clearCookie('session_token').clearCookie('token');
    res.redirect("/");
}); 

request.get(`/hacking.html`, time_finish, (req, res) => {
    res.sendFile(path.join(__dirname, "/hacking.html"));
});
//

// Admin har tillgång till alla dessa webbsidor
request.get("/admin/admin_panel.html", admin_check, (req, res) => {
    res.sendFile(path.join(__dirname, "/admin_panel.html"))
});

//moderator och admin har tillgång till alla dessa webbsidor 
request.get(`/moderator/moderator_panel.html`, mod_check, (req, res) => {
    res.sendFile(path.join(__dirname, "/moderator.html"));
});

// inloggning page för webbsidan
request.post("/login", async (req, res) => {
    if (req.body.username && req.body.password) { // kollar om POST request har en username och password värde

        if (req.body.username.length > 0 && req.body.password.length > 0) { // kollar om värdet eller tomt eller inte
            try {
                const username = req.body.username;
                
                const password = crypto.createHash("sha512").update(req.body.password).digest("hex"); // hashar lösenordet som användaren har skrivit
                
                const [login] = await sql.execute("SELECT username, password, role, jwt_secret, account_status FROM users WHERE username = ? AND password = ?", [username, password]); // kollar om hashad lösenordet stämmer med användarnamnen

                if (login.length !== 0) { 
                    const [time_finished] = await sql.execute("SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(time, 'T', -1), '.', 1) AS time FROM users_finish WHERE username = ?", [username]); // tar emot användarens tid om den finns inom tabeln

                    if (time_finished.length !== 0) {
                        user_finish = time_finished[0].time
                    } else {
                        user_finish = "null"
                    }

                    const user = login[0];
                    const [flags] = await sql.execute("SELECT success_flags FROM users_flags WHERE username = ?", [username]); // tar emot användarens flaggor och lägger det i deras token
                    const flagList = flags.length > 0 ? JSON.parse(flags[0].success_flags) : [];

                    const token = jwt.sign({ username: user.username, role: user.role, flags: flagList, time: user_finish, account_status: user.account_status}, user.jwt_secret, { expiresIn: "1h" });
                    

                    req.session.regenerate((err) => { // genererar om deras session token och lägger användarnamn inom session som kontots användarnamn 
                        if (!err) {

                            req.session.user = user.username;
                            req.session.save(err => {
                                
                                if (!err) {

                                    res.cookie("token", token, { httpOnly: false });
                                    res.status(200).send("Inloggad"); // skickar status 200 med datan "inloggad"

                                } else {
                                    return res.status(500).send("Session error");
                                }

                            });

                        } else {
                            console.error('Session regeneration error:', err);
                            return res.status(500).send("Session error");
                        }
                    });

                } else {
                    return res.status(401).send("Fel användarnamn eller lösenord");
                }

            } catch (error) {
                console.error(error);
                return res.status(500).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.");
            }

        } else { 
            return res.status(400).send("Användarnamn eller lösenord saknas");
        }

    } else {
        return res.status(400).send("Fyll i användarnamn och lösenord")
    }

});

// registrering page för webbsidan
request.post("/register", xss(), async (req, res) => {
    if (req.body.username && req.body.password) { // kollar om användaren har angett ett användarnamn och lösenord

        if (req.body.username.length > 0 && req.body.password.length > 0) { // kollar om längden på användarnamn och lösenord är inte 0

            if (req.body.username.length < 16) { // kollar om användarens användarnamn är längre än 16 tecken

            const StandardUtf8Regex = /[^\p{L}\p{N}\s]/gu; // skapar en regex för användarnamn

                if (StandardUtf8Regex.test(req.body.username) === false)  { // Kollar om någon tecken tillhör inte regexen 

                    if (req.body.password.length > 6) { // kollar om lösenordet är minst 6 tecken lång
                        try {

                            const username = req.body.username;

                            // Check if user exists
                            const [existing] = await sql.execute("SELECT id FROM users WHERE username = ?", [username]); // kollar om användaren finns eller inte

                            if (existing.length === 0) {

                                const password = crypto.createHash("sha512").update(req.body.password).digest("hex"); // hashar användarens lösenord
                                
                                jwt_secret = crypto.randomBytes(32).toString('hex') // skapar en jwt_secret

                                role = "user";

                                account_status = "false";

                                await sql.execute("INSERT INTO users (username, password, role, jwt_secret, account_status) VALUES (?, ?, ?, ?, ?)", [username, password, role, jwt_secret, account_status]); // lägger till användarens info inom databasen

                                return res.status(200).send("Konto skapat");

                            } else {
                                return res.status(401).send("Användarnamnet finns redan");
                            }

                        } catch (error) {
                            console.error(error);
                            return res.status(500).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.");
                        }

                    } else {
                        return res.status(400).send("Lösenordet måste vara minst 6 tecken långt");
                    }

                } else {
                    return res.status(400).send("Tecken ej tillåtet");
                }

            } else {
                return res.status(400).send("Användarnamn ska va mindre än 16 tecken långt")
            }

        } else {
            return res.status(400).send("Användarnamn eller lösenord saknas");
        }

    } else {
        return res.status(400).send("Fyll i användarnamn och lösenord")
    }
});

// submit page för flaggor
request.post("/submit", async (req, res) => {
    if (req.body.name && req.body.flag) { // kollar om användaren har skickat både namnen och flaggan
        if (req.body.name.length > 0 && req.body.flag.length > 0) { // kollar om både namn och flagga har minst 1 bokstav

            try {
                const username = req.user.username; // får användarnamnet från användarens token
                const flagName = req.body.name; 
                const submittedFlag = req.body.flag; 
                const user_time = req.user.time; const user_role = req.user.role;

                // Bekräftar om namnet finns och om flaggan är giltigt och däremot tar flaggans poäng 
                const [flag] = await sql.execute("SELECT flag, points FROM flags WHERE name = ? AND flag = ?", [flagName, submittedFlag]);
                
                if (flag.length !== 0) {

                    // tar användarens jwt_secret
                    const [user_info] = await sql.execute("SELECT jwt_secret FROM users WHERE username = ?", [username]);

                    jwt_secret = user_info[0].jwt_secret;

                    // tar användarens nuvarande klarat flaggor
                    const [current] = await sql.execute("SELECT success_flags, total_points FROM users_flags WHERE username = ?", [username]);
                    
                    flagList = current.length > 0 ? JSON.parse(current[0].success_flags) : []; // skapar en lista ur användarens nuvarande flaggor och kollar om hen har redan löst utmanningen
                    if (flagList.includes(flagName)) {
                        return res.status(401).send("Du har redan löst flaggan");
                    }
                    flagList.push(flagName); // lägger till flaggan till användarens klarat flaggor lista

                    points_updated = current[0].total_points + flag[0].points // adderar användarens nuvarande poäng med flaggans poäng 

                    await sql.execute("UPDATE users_flags SET success_flags = ?, total_points = ? WHERE username = ?", [JSON.stringify(flagList), points_updated, username]); // uppdaterar användarens flaggor och poäng inom databasen

                    // generera en ny token till användaren med uppdaterad information
                    const token = jwt.sign({username: username, role: user_role, flags: flagList, time: user_time, account_status: user.account_status}, jwt_secret, { expiresIn: "1h" });

                    // updatera token inom databasen och cookies
                    res.cookie("token", token, { httpOnly: false });

                    broadcastSSEUpdate(); // uppdatera leaderboard
                    return res.status(200).send("PWNED!!"); // skick tillbaka att flaggan var giltigt 

                } else {
                    return res.status(401).send("Felaktig flagga");
                }

            } catch (error) {
                console.error(error)
                return res.status(500).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.");
            }

        } else {
            return res.status(400).send("Namn eller flagga saknas")
        }
    } else {
        return res.status(400).send("Dåligt client request")
    }
});

// byta lösenord page för webbsidan
request.post("/user/change_password", async (req, res) => {
    if (req.body.password && req.body.password_confirm) { // kollar om lösenord och bekräftad lösenordet finns

        if (req.body.password.length >= 6) { // kollar om lösenordet är minst 6 tecken lång

            if (req.body.password === req.body.password_confirm) { // kollar om lösenordet och bekräftad lösenordet är samma

                try {

                    const username = user.username // får användarnamnet från cookie token
                    
                    const password = crypto.createHash("sha512").update(req.body.password).digest("hex"); // hashar lösenordet

                    const jwt_secret = crypto.randomBytes(32).toString('hex') // skapar en ny jwt_secret

                    await sql.execute("UPDATE users SET password = ?, jwt_secret = ? WHERE username = ?", [password, jwt_secret, username]); // sätter nya hashat lösenordet och jwt_secret inom databasen

                    const token = jwt.sign({username: username, role: req.user.role, flags: req.user.flags, time: req.user.time, account_status: req.user.account_status}, jwt_secret, { expiresIn: "1h" }); // genererar ett ny jwt token för användaren för att de skulle va fortfarande inloggad 
                    
                    res.cookie("token", token, { httpOnly: false }); // skickar jwt token till användaren
                    return res.status(200).send("Lösenordet har ändrats"); // skickar till användaren att lösenordet har ändrats med status 200
                } catch (error) {
                    console.error(error)
                    return res.status(400).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.");
                }
            } else {
                return res.status(400).send("Lösenorden matchar inte")
            }

        } else {
            return res.status(400).send("Lösenordet måste vara minst 6 tecken långt");
        }

    } else {
        return res.status(400).send("Användarnamn eller lösenord saknas");
    }
});

const CACHE_TTL = 30000; // en cache kan vara max 30 sekunder gammal

const FlagCheckCache = new Map(); // skapar en cache för /admin/flag_exist_check för att minimera delay mellan webbsidan och användaren 
                             // funkar genom att lägga till flaggans namn och kategori inom mappen för att hämnta upp senare om sin tid har inte gåt ut

request.post("/admin/flag_exist_check", admin_check, async (req, res) => {
    if (!req.body.queryName || !req.body.queryCategory) { // kållar om queryName och QueryCategory finns inom requesten
        return res.status(400).json({ error: "Bad request" }); // svara annars med error "Query too short"
    }

    const query = { queryName: req.body.queryName, queryCategory: req.body.queryCategory } // skapar en konstant variable där queryName och queryCategory är tillsatt i 
    const cacheKey = {name: query.queryName, category: query.queryCategory}; // skapar en konstant variabel där det finns queryName och queryCategory för att lägga till eller hitta i "FlagCheckCache"
    if (FlagCheckCache.has(cacheKey)) { 
        const { data, timestamp } = FlagCheckCache.get(cacheKey); // om variabeln cacheKey finns inom FlagCheckCache ta datan och tiden där den skapades
        if (Date.now() - timestamp < CACHE_TTL) { // om den skapades max 30 sekunder sen så skicka datan från cachen till användaren 
            return res.status(200).json({ exists: data });
        }
    }

    try { // kollar om det finns en flagga med samma namn och kategori
        const [flag] = await sql.execute(
            `SELECT id FROM flags 
            WHERE name = ? AND category = ?`,
            [query.queryName, query.queryCategory]            
        );

        if (flag.length > 0) { // anger värdet till variabeln exists om flaggan finns redan eller inte
            exists = "Flaggan finns redan";
        } else {
            exists = false;
        }

        FlagCheckCache.set(cacheKey, { // tillsätter en ny cache till FlagCheckCache där data är lika med exists och timestampar det med nuvarande tid
            data: exists,
            timestamp: Date.now()
        });

        return res.status(200).json({exists: exists}); // skickar tillbaka till användaren om flaggan finns eller inte
    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.");
    }
});

const categorySearchCache = new Map(); // Skapar map för /admin/search_categories för att cache resultatet

request.post("/admin/search_categories", admin_check, async (req, res) => {
    if (!req.body.query || req.body.query.length < 2) { // kollar om query finns och om den är minst 2 bokstäver 
        return res.status(400).json({ error: "Query too short" });
    }
    
    const query = req.body.query.trim().toLowerCase(); // skapar en konstant variabel där man tar bort mellanslag runt om stringen och ersätter alla versaler och ersätter det med gemener 
    const cacheKey = `search:${query}`; // sätter det i ett konstant variabel som heter "cacheKey" där det finns query variabeln
    
    // Check cache first
    if (categorySearchCache.has(cacheKey)) { // om värdet av variabeln cacheKey finns inom categorySearchCache map så tar den ut datan och timestamp
        const { data, timestamp } = categorySearchCache.get(cacheKey);
        if (Date.now() - timestamp < CACHE_TTL) { // om cachen är inte äldre än 30 sekunder så anger det värdet av datan från cachen och skickar det över till användaren
            return res.json({ category: data });
        }
    }
    
    try {
        const [category] = await sql.execute(
            `SELECT DISTINCT category FROM flags 
            WHERE category LIKE ? 
            ORDER BY 
            CASE WHEN category LIKE ? THEN 0 ELSE 1 END, -- Exact matches first
            category
            LIMIT 10`,
            [`${query}%`, `${query}`] // Sök efter prefixmatchningar först
        );
        
        // cache resultatet
        categorySearchCache.set(cacheKey, {
            data: category,
            timestamp: Date.now()
        });
        
        return res.json({ category }); // skicka över resultatet till användaren
    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({ error: "Search failed" });
    }
});

// Allting fungerar exakt samma som /admin/search_categories ///////////////////////////////////////////////////////////
const flagSearchCache = new Map();

request.post("/admin/search_flags", admin_check, async (req, res) => {
    if (!req.body.query || req.body.query.length < 2) { 
        return res.status(400).json({ error: "Query too short" });
    }
    
    const query = req.body.query.trim().toLowerCase();
    const cacheKey = `search:${query}`;
    
    // Check cache first
    if (flagSearchCache.has(cacheKey)) {
        const { data, timestamp } = flagSearchCache.get(cacheKey);
        if (Date.now() - timestamp < CACHE_TTL) {
            return res.json({ flags: data });
        }
    }
    
    try {
        // Use parameterized query with LIMIT
        const [flags] = await sql.execute(
            `SELECT name, category FROM flags 
            WHERE name LIKE ? 
            ORDER BY 
            CASE WHEN name LIKE ? THEN 0 ELSE 1 END, -- Exact matches first
            name
            LIMIT 10`,
            [`${query}%`, `${query}`]
        );
        
        // Cache the results
        flagSearchCache.set(cacheKey, {
            data: flags,
            timestamp: Date.now()
        });
        
        return res.json({ flags });
    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({ error: "Search failed" });
    }
});

const userSearchCache = new Map();

request.post("/admin/search_users", mod_check, async (req, res) => {
    if (!req.body.query || req.body.query.length < 2) {
        return res.status(400).json({ error: "Query too short" });
    }
    
    const query = req.body.query.trim().toLowerCase();
    const cacheKey = `search:${query}`;
    
    // Check cache first
    if (userSearchCache.has(cacheKey)) {
        const { data, timestamp } = userSearchCache.get(cacheKey);
        if (Date.now() - timestamp < CACHE_TTL) {
            return res.json({ users: data });
        }
    }
    
    try {
        // Use parameterized query with LIMIT
        const [users] = await sql.execute(
            `SELECT username, role FROM users 
            WHERE username LIKE ? 
            ORDER BY 
            CASE WHEN username LIKE ? THEN 0 ELSE 1 END, -- Exact matches first
            username
            LIMIT 10`,
            [`${query}%`, `${query}`]
        );
        
        // Cache the results
        userSearchCache.set(cacheKey, {
            data: users,
            timestamp: Date.now()
        });
        
        return res.json({ users });
    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({ error: "Search failed" });
    }
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

request.post("/flags/get_category_flags", async (req, res) => { // för att få alla flaggor som tillgör en viss kategori
    if (req.body.category && req.body.category.length > 0) {  // Kollar om req.body.category finns inte eller om den är inte längre än 0 bokstäver 
        try {
            category = req.body.category;
            const [flags] = await sql.execute("SELECT name, description, difficulty, points, url FROM flags WHERE category = ?", [category]); // få alla flaggors namn, beskrivning, svårighet, poäng, url som har samma kategori i en lista

            const data = {category: JSON.stringify(flags)}; // lägger alla flaggor i en json format och skickar det över till användaren
            return res.status(200).send(data);
        } catch (error) {
            console.error(error);
            return res.status(500).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.");
        }
    } else {
       return res.status(400).send("Dåligt client request"); 
    }
});

request.post("/flags/get_category", async (req, res) => { // få alla kategori
    try {
        const page = parseInt(req.body.page || 1); // få req.body.page och gör det till en intiger annars ange den värde 1
        const flags_user = (req.user.flags || "") // få användarens flaggor genom deras cookie token
        const userFlagsSet = new Set(flags_user); // skapa en ny mapp där alla användarens flaggor är lika med flags_user
        
        offset = (page - 1) * 9; // ta page, subtrahera 1 och sedan multiplacera med 9 för att kunna få offset inom sql queryn
        const [categories] = await sql.execute("SELECT DISTINCT category FROM flags LIMIT 9 OFFSET ?", [offset]); // få alla kategorier (max 9) och hoppar över ett vissa antal som bestäms av offset 

        [flagQueryCount] = await sql.execute("SELECT COUNT(name) AS flagCount FROM flags"); // få antal flaggor som finns inom databasen
        let flagCount = flagQueryCount[0].flagCount;

        pageCount = Math.floor(flagCount/9); // dela antal flaggor med 9 och avrunda ner talet till ett heltal

        const categories_value = categories.map(item => item.category); // lägg varenda kategori i ett lista
        if (categories_value.length === 0) { // om längden av categorin är lika med 0 skicka att sidan är inte giltigt
            return res.status(400).send("Invalid page");
        }
            
        const [flags] = await sql.execute(`SELECT category, name FROM flags WHERE category IN (${categories_value.map(() => '?').join(',')})`, categories_value) // få alla kategori och flaggor inom kategorin från databasen  
        const data_completed_percentage = flags.filter(flag => userFlagsSet.has(flag.name)); // lägg till alla flaggor som finns inom userFlagsSet och flags


        // skapar två nya mappar
        const totalFlagsMap = new Map(); 
        const userFlagsMap = new Map();

          // 2. Enkel pass för att räkna totaler
        for (const { category } of flags) {
            totalFlagsMap.set(category, (totalFlagsMap.get(category) || 0) + 1);
        }

        // 3. Enkel pass för att räkna slutföranden av användare
        for (const { category } of data_completed_percentage) {
            userFlagsMap.set(category, (userFlagsMap.get(category) || 0) + 1);
        }

        // 4. Beräkna procentsatser (O(k), där k = unika kategorier)
        const result = [];
        for (const [category, total] of totalFlagsMap) {
            const completed = userFlagsMap.get(category) || 0;
            result.push({
            category,
            percentage: Math.round((completed / total) * 10000) / 100, // 2 decimaler
            completed,
            total
            });
        }

        let data_categories = JSON.stringify(result);
        
        const data = {categories: data_categories, page: pageCount};
        return res.status(200).send(data);
    } catch (error) {
        console.error(error);
        return res.status(500).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.");
    }
});

// få användarens info
request.post("/user/get_user_info", async (req, res) => {
    if (req.body.username && req.body.username.length > 0) { // kollar om användaren har angett ett användarnamn och om den är längre än 0 tecken
        try {
            if (req.body.username === "CurrentUserProfile") { // om användarnamnet är "CurrentUserProfile" så ange variabeln username användarens användarnamnet, annars ange den namnet som användaren har skrivit in 
                username = req.user.username;
            } else {
                username = req.body.username;
            }
            const [user_info] = await sql.execute("SELECT username, role, account_status, total_points, SUBSTRING_INDEX(SUBSTRING_INDEX(completion_time, 'T', -1), '.', 1) AS completion_time, json_length(success_flags) as success_flags, position FROM ( SELECT username, role, account_status, total_points, completion_time, success_flags, RANK() OVER (ORDER BY total_points DESC) AS position FROM leaderboard ) AS ranked_users WHERE username = ?", [username]); // få användarens info från databasen, såsom  tid, plats på leaderboard, poäng och role 
            if (user_info.length > 0) { // om användarens kan inte hittas´skicka tillbaka att användaren finns inte
                user_data = JSON.stringify(user_info[0]); // annars lägg till användaren i ett JSON string
                const data = {user_info: user_data}; // lägg till det i ett till json string i ett parameter som heter user_info och spara det i ett variabel "data"
                return res.status(200).send(data); // skicka variabelns värde till användaren
            } else {
                return res.status(400).send("Användaren finns inte")
            }

        } catch (error) {
            console.error(error);
            return res.status(500).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.");
        }
    } else {
        return res.status(400).send("Dålig client request")
    }
});

request.post("/user/get_user_flags", async (req, res) => { // för att kunna få användarens flaggor
    if (req.body.username && req.body.count && req.body.page) { // kollar om användaren har skickat alla nödvänliga json parameters
        
        regex = /[^0-9]/;

        if (req.body.username.length > 0 && !regex.test(req.body.count) && !regex.test(req.body.page)) { //  kollar om användaren har angett ett värde till de och om det fanns någoting inom page eller count som kunde inte parsa som en intiger
            try {

                const count = parseInt(req.body.count); 
                const page = parseInt(req.body.page);
                
                if (req.body.username === "CurrentUserProfile") { // om användarnamnet är "CurrentUserProfile" så ange variabeln username användarens användarnamnet, annars ange den namnet som användaren har skrivit in 
                    username = req.user.username;
                } else {
                    username = req.body.username;
                }

                const [user_flags] = await sql.execute("SELECT success_flags FROM leaderboard WHERE username = ?", [username]); // får användarens flaggor från databasen
                if (user_flags.length > 0) { // kollar om användaren finns eller om databasen har skickat något tillbaka

                    flags_list = JSON.parse(user_flags[0].success_flags); // gör det till en string object
                    // detta används för att få antal flaggor användaren söker efter samtidigt begränsa den
                    flag_current_page = JSON.stringify(flags_list.slice(((page-1)*count), (page*count))); // får alla flaggor mellan page användaren sökte på subtraherade med 1 och multiplacerade med antal flaggor användaren vill ha och begränsad med page multiplacerade med antal flaggor användaren söte på 
                    const [flags] = await sql.execute(`SELECT f.name, f.difficulty, f.points, f.category FROM flags f JOIN JSON_TABLE(?, '$[*]' COLUMNS( flag_name VARCHAR(255) PATH '$' )) AS jt ON f.name = jt.flag_name`, [flag_current_page]); // får alla flaggornas info           
                    flags_data = JSON.stringify(flags) // lägger det i ett json

                    let pages = Math.ceil(flags_list.length/count); // får antal sidor där det finns mer flaggor för att se

                    const data = {flags: flags_data, pages: pages} // lägger allting i ett json med sina egna parameters
                
                    return res.status(200).send(JSON.stringify(data)); // gör den till ett json string och skickar över till användaren 

                } else {
                    return res.status(400).send("Användaren finns inte")
                }

            } catch (error) {
                console.error(error);
                return res.status(500).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.")
            }

        } else {
            console.log("test2");
            return res.status(400).send("Dåligt client request");
        }

    } else {
        console.log("test");
        return res.status(400).send("Dåligt client request");
    }
});



// få flaggans infå
request.post("/admin/get_flag_info", admin_check, async (req, res) => { // är för att få info för en viss flagga
    if (req.body.flag) { // kollar om användaren har skickat en json request där flag parameter finns
        if (req.body.flag.length > 0) { // kollar om den är tom eller inte
            try {
                const flag = req.body.flag.trim(); // tar bort alla mellanslag som finns runt namnet
                
                const [flag_query] = await sql.execute("SELECT name, flag, description, difficulty, points, category, url, SUBSTRING_INDEX(SUBSTRING_INDEX(created_at, 'T', -1), '.', 1) AS created_at, SUBSTRING_INDEX(SUBSTRING_INDEX(updated_at, 'T', -1), '.', 1) AS updated_at FROM flags WHERE name = ?", [flag]); // får flaggan, poäng, beskrivningen, svårighet, kategori, url, tiden där den skapades och sis regirades
                if (flag_query.length > 0) { // kollar om sql databasen har skickat något tillbaka för att bekräfta om flaggan finns eller inte
                    const flag_info = flag_query[0];

                    const data = JSON.stringify({data: flag_info}); // lägger all info i ett json string och skickar över det till användaren

                    return res.status(200).send(data);
                } else {
                    return res.status(400).send("Flaggan finns inte");
                }
            } catch (error) {
                console.error(error);
                return res.status(500).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.");
            }
        } else {
            return res.status(400).send("Dålig client request");
        }
    } else {
        return res.status(400).send("Dålig client request");
    } 
})

request.post("/admin/apply_flag_changes", admin_check, /*används för att filterera mot xss i t.ex beskrivningen av flaggan, url av flaggan, namn, kategori*/ xss(), async (req, res) => { // används för att tillämpa ändringar till flaggan
    if (req.body.flag_selected && req.body.name && req.body.url && req.body.category && req.body.difficulty && req.body.points && req.body.description) { // kollar om vald flagga parameter finns, namn, url, kategori, svårighet, poäng och beskrivningen av flaggans ändringar finns i parameter
        regex = /[^0-9]/; // regex för att filtrera mot allt som är inte en nummer

        const flag_selected = req.body.flag_selected;

        var nameSplit = req.body.name.split(' '); // dela upp varje del av strängen där det finns ett mellanslag och sät de i ett lista
        const name = nameSplit.filter(word => word.length > 0).join(' '); // ta bort alla tomma värden och sätt de i ett sträng
        
        const url = req.body.url.trim(); // ta bort alla mellanslag som finns runt om urlen

        var categorySplit = req.body.category.split(' '); // dela upp varje del av strängen där det finns ett mellanslag och sät de i ett lista
        const category = categorySplit.filter(word => word.length > 0).join(' '); // ta bort alla tomma värden och sätt de i ett sträng

        const difficulty = req.body.difficulty;
        
        var descriptionSplit = req.body.description.split(' '); // dela upp varje del av strängen där det finns ett mellanslag och sät de i ett lista
        const description = descriptionSplit.filter(word => word.length > 0 && word.length < 30).join(' '); // ta bort alla tomma värden och ord som är längre än 30 bokstäver och sätt de i ett sträng

        // kollar om namnet är inte tomt och är inte längre än 19 bokstäver, kollar om url parameter är tom, kollar om kategori paramter är tom eller om den är längre än 23 bokstäver, kontrollerar om difficulty är en giltigt svårighet, kollar om användaren har skrivit in något som är inte ett numer och kollar om beskrivningen är tom eller om den är längre än 150 bokstäver
        if (name.length > 0 && name.length <= 19 && url.length > 0 && category.length > 0 && category.length <= 23 && flag_difficulties.includes(difficulty) && !regex.test(req.body.points) && description.length > 0 && description.length <= 150) {
            
            try {
                // tar emot flaggans id, namn och poäng från databasen
                const [flag_check] = await sql.execute("SELECT id, name, points FROM flags WHERE name = ?", [flag_selected]);
                if (flag_check.length > 0) { // kollar om flaggan finns genom att kolla om databasen har skickat något info tillbaka 
                    const points = parseInt(req.body.points);

                    // lägger tillämpar ändringar till flaggan i databasen
                    await sql.execute("UPDATE flags SET name = ?, url = ?, category = ?, difficulty = ?, points = ?, description = ? WHERE id = ?", [name, url, category, difficulty, points, description, flag_check[0].id]);
                    
                    // uppdaterar alla användarens cookie token som har klarat detta flaggan
                    await UserSSEUpdate(flag_selected);

                    // uppdaterar leaderboard för alla användare
                    broadcastSSEUpdate();

                    // skickar att ändringarna har blivit tillämpat till användaren
                    return res.status(200).send("Ändringar tillämpade");
                } else {
                    return res.status(400).send("Flaggan finns inte");
                }
            } catch (error) {
                console.error(error);
                return res.status(500).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.");
            }

        } else {
            return res.status(400).send("Dålig client request");
        }
    } else {
        return res.status(400).send("Dålig client request");
    }
})

request.post("/admin/create_flag", admin_check, /*används för att filterera mot xss i t.ex beskrivningen av flaggan, url av flaggan, namn, kategori*/ xss(), async (req, res) => { // för att skapa flaggor
    if (req.body.name && req.body.url && req.body.category && req.body.difficulty && req.body.points && req.body.description) { // kollar om namn, url, kategori, svårighet, poäng och beskrivning paramter finns
        regex = /[^0-9]/; // regex för att filtrera mot allt som är inte en nummer
        
        var nameSplit = req.body.name.split(' '); // dela upp varje del av strängen där det finns ett mellanslag och sät de i ett lista
        const name = nameSplit.filter(word => word.length > 0).join(' '); // ta bort alla tomma värden och sätt de i ett sträng
        
        const url = req.body.url.trim();

        var categorySplit = req.body.category.split(' '); // dela upp varje del av strängen där det finns ett mellanslag och sät de i ett lista
        const category = categorySplit.filter(word => word.length > 0).join(' '); // ta bort alla tomma värden och sätt de i ett sträng

        const difficulty = req.body.difficulty;
        
        var descriptionSplit = req.body.description.split(' '); // dela upp varje del av strängen där det finns ett mellanslag och sät de i ett lista
        const description = descriptionSplit.filter(word => word.length > 0 && word.length < 30).join(' '); // ta bort alla tomma värden och ord som är längre än 30 bokstäver och sätt de i ett sträng

        // kollar om namnet är inte tomt och är inte längre än 19 bokstäver, kollar om url parameter är tom, kollar om kategori paramter är tom eller om den är längre än 23 bokstäver, kontrollerar om difficulty är en giltigt svårighet, kollar om användaren har skrivit in något som är inte ett numer och kollar om beskrivningen är tom eller om den är längre än 150 bokstäver
        if (name.length > 0 && name.length <= 19 && url.length > 0 && category.length > 0 && category.length <= 23 && flag_difficulties.includes(difficulty) && !regex.test(req.body.points) && description.length > 0 && description.length <= 150) {
           
            try {
                // kollar om flaggan redan finns eller inte genom att skicka en query till databasen och kollar om den svarade med flaggans id eller inte
                const [flag_check] = await sql.execute("SELECT id FROM flags WHERE name = ?", [name]);
                if (flag_check.length === 0) {
                    const points = parseInt(req.body.points);

                    // skapar flaggans kod till att lösa den
                    const flag = `FLAG{${crypto.randomBytes(16).toString('hex')}}`

                    // skapar flaggan
                    await sql.execute("INSERT INTO flags (name, flag, url, category, difficulty, points, description) VALUES (?, ?, ?, ?, ?, ?, ?)", [name, flag, url, category, difficulty, points, description])
                    
                    // uppdatera alla användarens cookie token som har redan klara alla flaggorna genom att ta bort time paramter från deras jwt token
                    await UserSSEUpdateFlagCreate();

                    // uppdatera antal flaggor inom databasen och spara det inom variabeln flag_count
                    flag_count = await update_flag_count();

                    // uppdatera leaderboard för alla användare
                    broadcastSSEUpdate();
                    
                    // skickar över flaggans kod till användaren
                    data = {flag: flag}
                    return res.status(200).send(JSON.stringify(data));
                } else {
                    return res.status(400).send("Flaggan finns redan");
                }
            } catch (error) {
                console.error(error);
                return res.status(200).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.");
            }

        } else {
            return res.status(400).send("Dålig client request");
        }
    } else { 
        return res.status(400).send("Dålig client request");
    }
});

request.post("/admin/account_edit", mod_check, async (req, res) => {
    // för att kontrollera request värden på checkbox och roles
    const changeUserSession = ["true", "false"];
    const clearUserTime = ["true", "false"];
    const clearUserFlags = ["true", "false"];
    const accountStatusRoles = ["suspended", "banned", "false"];

    if (req.body.username && req.body.flags && req.body.role && req.body.status && req.body.clearTime && req.body.clearFlags && req.body.logout) { // kollar om alla json parameters finns

        if (req.body.username.length > 0 && accountStatusRoles.includes(req.body.status) && availableRoles.includes(req.body.role) && changeUserSession.includes(req.body.logout) && clearUserTime.includes(req.body.clearTime) && clearUserFlags.includes(req.body.clearFlags)) { // kontrollera värden på logout, clearflags, cleartime, role och se till att användarnamnet är mer än 0 tecken lång

            if (req.body.username === req.user.username && !(req.body.role === req.user.role || req.body.status === req.user.status)) { // admin/moderator får inte ändra deras egen användarnamn eller role för att försäkra att minst 1 konto har möjligheten att ändra konto
                return res.status(400).send("Du får inte byta din egen role eller status")
            }

            try {
                const username = req.body.username;

                const [user_flags] = await sql.execute("SELECT role, total_points, success_flags FROM leaderboard WHERE username = ?", [username]); // får användarens poäng och flaggor från databasen
                if (user_flags.length > 0) { // kollar om användaren finns
                    if (req.user.role === "admin" || (req.user.role === "moderator" && user_flags[0].role === "user")) { // för att förhindra moderatorn att ändra konton som inte har rolen user
                        if (req.user.role === "admin" || (req.user.role === "moderator" && req.body.role === "user")) { // förhindra moderator att ändra någon kontons role

                            let availableUserFlags = JSON.parse(user_flags[0].success_flags || '[]'); // sätter flaggorna till en lista annars så är listan tom
                            let TotalUserPoints = parseInt(user_flags[0].total_points) // gör användaren till en intiger och anger det till en variabel

                            const clearFlags = req.body.clearFlags === "true" ? 1 : 0; // om req.body.clearFlags string är "true" ange variabeln clearFlags 1 annars ange den 0
                            const removeUserFlags = req.body.flags; // om req.body.flags string är "true" ange variabeln removeUserFlags 1 annars ange den 0
                            
                            let RemovedFlags = []; // skapar en tom lista för att ange den namnet av flaggorna som ska ta bort från användarens flaggor
                            let PointsToReduct = 0; // skapar en int för att ange den värdet av poäng som ska ta bort från användarens poäng

                            if (req.body.flags.length > 0 && !clearFlags) { // om listan "req.body.flags" är längre än 0 och clearFlags checkbox är inte true
                                removeUserFlags.forEach(flag => { // för varenda flagga inom req.body.flags lägg till det inom listan RemovedFlags och ta bort flaggan från availableUserFlags (användarens flaggor)
                                    RemovedFlags.push(flag);
                                    availableUserFlags = availableUserFlags.filter(f => f !== flag);
                                });
                                const [FlagsPoints] = await sql.execute(`SELECT points FROM flags WHERE name in (${RemovedFlags.map(() => '?').join(',')})`, RemovedFlags); // ta emot alla flaggornas poäng och sätt det i ett lista från databasen 
                                FlagsPoints.forEach(num => PointsToReduct += num.points); // för varenda poäng lägg till det inom PointsToReduct och substrahera användarens poäng med PointsToReduct
                                TotalUserPoints -= PointsToReduct;
                            }
                            const role = req.body.role;
                            const logout = req.body.logout === "true" ? 1 : 0; // om req.body.logout string är "true" ange variabeln logout 1 annars ange den 0
                            const clearTime = req.body.clearTime === "true" ? 1 : 0; // om req.body.clearTime string är "true" ange variabeln clearTime 1 annars ange den 0
                            const status = req.body.status;
                            
                            const conn = await sql.getConnection(); // avslutar till databasen
                            try {
                                await conn.beginTransaction(); // startar en rad kommando till databasen
                                
                                await conn.execute(
                                    "UPDATE users SET role = ?, account_status = ? WHERE username = ?", // regiera användarens role och konto status
                                    [role, status, username]
                                );
                                
                                if (logout) {
                                    await conn.execute(
                                        "UPDATE users SET jwt_secret = ? WHERE username = ?", // regiera användarens jwt secret om logout är 1
                                        [crypto.randomBytes(32).toString('hex'), username]
                                    );
                                }
                                
                                if (clearFlags) {
                                    await conn.execute(
                                        "UPDATE users_flags SET success_flags = '[]', total_points = 0 WHERE username = ?", // ta bort alla användarens flaggor och poäng om clearFlags är 1
                                        [username]
                                    );
                                } else {
                                    await conn.execute(
                                        "UPDATE users_flags SET success_flags = ?, total_points = ? WHERE username = ?", // annars om clearflags är inte lika med 1 regiera användarens flaggor och poäng
                                        [JSON.stringify(availableUserFlags), TotalUserPoints, username]
                                    );
                                }
                                
                                if (clearTime) {
                                    await conn.execute(
                                        "DELETE FROM users_finish WHERE username = ?", // radera användarens tid om clearTime är lika med 1
                                        [username]
                                    );
                                }
                                
                                await conn.commit(); // skicka sql query och avsluta kopplingen med databasen
                                
                                UserSSEUpdateUserEdit(username, role, availableUserFlags, clearTime, status); // uppdatera användarens role, flaggor, tid och status på token genom websocket
                                broadcastSSEUpdate(); // uppdatera leaderboard
                                return res.status(200).send("Ändringar tillämpas");
                            } catch (error) {
                                await conn.rollback();
                                throw error;
                            } finally {
                                conn.release();
                            }
                        } else {
                            return res.status(400).send('Du får inte regiera kontons role')
                        }
                    } else {
                        return res.status(400).send("Du får inte regiera den här kontot")
                    }
                } else {
                    return res.status(400).send("Användaren finns inte");
                }
            } catch (error) {
                console.error(error);
                return res.status(500).send("Oops an error occurred. Please contanct the admin if this problem keeps occurring.");
            }
        } else {
            return res.status(400).send("Fyll i alla parameters")
        }
    } else {
        return res.status(400).send("Dålig request");
    }
});

// Start Server
const server = request.listen(port, () => {
    console.log(`Server listening on port ${port}.`);
});

// kopplar websocket server
const wss = new WebSocket.Server({ server });