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

// Add a new endpoint to fetch all camping spots
app.get("/api/camping-spots", async (req, res) => {
    const db = new Database();
    try {
      const campingSpots = await db.getQuery(`
        SELECT 
          name, 
          description, 
          location, 
          image_path AS image, 
          price_per_night 
        FROM camping_spots
      `);
      res.status(200).json(campingSpots);
    } catch (error) {
      console.error("Error fetching camping spots:", error);
      res.status(500).json({ error: "Error fetching camping spots." });
    }
});

// Endpoint to fetch all camping spots owned by a specific user (owner)
app.get('/api/owner-camping-spots/:userId', async (req, res) => {
    const { userId } = req.params; // Get the userId from the request params

    const db = new Database();

    try {
        // Query to get camping spots owned by the user (match with owner_user_id)
        const ownerCampingSpotsQuery = await db.getQuery(`
            SELECT 
                camping_spot_id,
                name, 
                description, 
                location, 
                image_path AS image, 
                price_per_night 
            FROM camping_spots 
            WHERE owner_user_id = ?
        `, [userId]);

        if (ownerCampingSpotsQuery.length === 0) {
            return res.status(404).json({ message: "Geen campings gevonden voor deze eigenaar." });
        }

        res.status(200).json(ownerCampingSpotsQuery); // Return the camping spots
    } catch (error) {
        console.error("Error fetching owner's camping spots:", error);
        res.status(500).json({ error: "Er is een fout opgetreden bij het ophalen van de campings." });
    }
});


// Endpoint om alle boekingen van een specifieke gebruiker op te halen
app.get('/api/user-bookings/:userId', async (req, res) => {
    const { userId } = req.params;

    const db = new Database();
    // Query om de boekingen van de gebruiker en bijbehorende camping details op te halen
    const bookingsQuery = await db.getQuery(`
        SELECT 
            b.booking_id,
            b.check_in_date,
            b.check_out_date,
            b.status,
            cs.name AS camping_name,
            cs.location AS camping_location,
            cs.price_per_night
        FROM bookings b
        JOIN camping_spots cs ON b.camping_spot_id = cs.camping_spot_id
        WHERE b.user_id = ?
        ORDER BY b.check_in_date DESC
    `, [userId]);

    if (bookingsQuery.length === 0) {
        return res.status(404).json({ message: "Geen boekingen gevonden voor deze gebruiker." });
    }

    res.status(200).json(bookingsQuery);
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

        // Login succesvol, stuur userId, username, email en role terug
        const response = {
            message: 'Login succesvol',
            userId: user.user_id,
            username: user.username,
            email: user.email,
            role: user.role,
        };
        console.log('Login Response:', response); // Log the response here
        res.status(200).json(response);
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

// Add a new endpoint to handle POST requests for new camping spots
app.post("/api/camping-spots", (req, res) => {
    const { name, description, location, price_per_night, image_path } = req.body;
  
    const sql = `
      INSERT INTO camping_spots (name, description, location, price_per_night, image_path)
      VALUES (?, ?, ?, ?, ?)
    `;
  
    db.query(sql, [name, description, location, price_per_night, image_path], (err, result) => {
      if (err) {
        console.error("Error inserting new camping spot:", err);
        return res.status(500).json({ error: "Error adding camping spot." });
      }
      res.status(201).json({ message: "Camping spot added successfully!" });
    });
  });

  // delete camping spot
  app.delete('/api/camping-spot/:campingId', async (req, res) => {
    const { campingId } = req.params;
    const db = new Database();

    try {
        // First, delete the related reviews
        await db.getQuery(`
            DELETE FROM reviews 
            WHERE camping_spot_id = ?
        `, [campingId]);

        // Second, delete the related bookings
        await db.getQuery(`
            DELETE FROM bookings 
            WHERE camping_spot_id = ?
        `, [campingId]);

        // Third, delete the related availabilities
        await db.getQuery(`
            DELETE FROM availabilities 
            WHERE camping_spot_id = ?
        `, [campingId]);

        // Now delete the camping spot itself
        const result = await db.getQuery(`
            DELETE FROM camping_spots 
            WHERE camping_spot_id = ?
        `, [campingId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Camping spot not found" });
        }

        console.log("Deletion result:", result);
        res.status(200).json({ message: "Camping spot deleted successfully" });
    } catch (error) {
        console.error("Error deleting camping spot:", error);
        res.status(500).json({ error: "Error deleting camping spot" });
    }
});

// Update user information endpoint
app.put('/api/users/:userId', async (req, res) => {
    const { userId } = req.params;
    const { username, email, role } = req.body; // Optional fields

    if (!username && !email && !role) {
        return res.status(400).json({ error: 'At least one field must be provided for update.' });
    }

    const db = new Database();

    try {
        // Construct the dynamic query based on provided fields
        const updates = [];
        const values = [];

        if (username) {
            updates.push('username = ?');
            values.push(username);
        }
        if (email) {
            updates.push('email = ?');
            values.push(email);
        }
        if (role) {
            updates.push('role = ?');
            values.push(role);
        }

        values.push(userId); // Add userId for the WHERE clause
        const updateQuery = `
            UPDATE users 
            SET ${updates.join(', ')}, updated_at = NOW()
            WHERE user_id = ?
        `;

        const result = await db.getQuery(updateQuery, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.status(200).json({ message: 'User information updated successfully.' });
    } catch (error) {
        console.error('Error updating user information:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});






  



// Server setup
app.listen(3000, () => {
    console.log('Server is running on port 3000 (Test: http://localhost:3000)');
});
