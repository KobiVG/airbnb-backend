// Importing the express module and other required packages
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Database = require('./classes/database.js');

// Create an express app
const app = express();

// Enable CORS
app.use(cors({
    origin: 'http://localhost:8080', // Allow requests from this origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
}));

// Middleware to parse JSON requests
app.use(bodyParser.json());

// Endpoints:

// Home endpoint
app.get('/', (req, res) => {
    res.send('Welcome to the Camping Booking API!');
});

// Haal alle campingplekken op
app.get('/api/camping-spots', (req, res) => {
    const db = new Database();
    db.getQuery('SELECT * FROM camping_spots').then((campingSpots) => {
            res.send(campingSpots);
        })
});

// Haal een specifieke campingplek op adhv id
app.get('/api/camping-spots/:id', (req, res) => {
    const { id } = req.params; // Haal de id uit de URL
    const db = new Database();
    db.getQuery('SELECT * FROM camping_spots WHERE camping_spot_id = ?', [id]).then((campingSpot) => {
            res.send(campingSpot[0]);
        })
});

// Haal (username, email, role) op adhv email
app.get('/api/users', async (req, res) => {
    const { email } = req.query; // Haal de email uit de query string

    if (!email) {
        return res.status(400).json({ error: 'Email is verplicht.' });
    }

    const db = new Database();

    try {
        // Haal alleen username, email en role op
        const userQuery = await db.getQuery('SELECT username, email, role FROM users WHERE email = ?', [email]);

        if (userQuery.length === 0) {
            return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
        }

        // Stuur de beperkte gebruikersgegevens terug
        res.status(200).json(userQuery[0]);
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van de gebruiker.' });
    }
});


// Login endpoint
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email en wachtwoord zijn verplicht.' });
    }

    const db = new Database();

    try {
        // Controleer of de gebruiker bestaat
        const userQuery = await db.getQuery('SELECT * FROM users WHERE email = ?', [email]);

        if (userQuery.length === 0) {
            return res.status(401).json({ error: 'Onjuist email of wachtwoord.' });
        }

        const user = userQuery[0];

        // Wachtwoordvergelijking (let op: wachtwoord hashing wordt aanbevolen)
        if (password !== user.password) {
            return res.status(401).json({ error: 'Onjuist email of wachtwoord.' });
        }

        // Login succesvol
        res.status(200).json({ message: 'Login succesvol', userId: user.id });
    } catch (error) {
        console.error('Login fout:', error);
        res.status(500).json({ error: 'Interne serverfout.' });
    }
});

// Register endpoint
app.post('/api/register', async (req, res) => {
    console.log("Incoming registration data:", req.body); // Log incoming data

    const { username, email, password, role } = req.body;

    // Validate request data
    if (!username || !email || !password || !role) {
        return res.status(400).json({ message: "All fields are required." });
    }

    const db = new Database();

    try {
        // Check if the email already exists
        const emailExists = await db.getQuery('SELECT * FROM users WHERE email = ?', [email]);

        if (emailExists.length > 0) {
            return res.status(400).json({ message: "Email already in use." });
        }

        // Insert new user into the database
        const query = `
            INSERT INTO users (username, email, password, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, NOW(), NOW())
        `;
        console.log("Executing query:", query, [username, email, password, role]);  // Log query
        await db.getQuery(query, [username, email, password, role]);

        res.status(201).json({ message: "User registered successfully." });
    } catch (error) {
        console.error("Error registering user:", error); // Log the full error
        res.status(500).json({ message: "Error registering user.", error: error.message });
    }
});

// Server setup
app.listen(3000, () => {
    console.log('Server is running on port 3000 (Test: http://localhost:3000)');
});
