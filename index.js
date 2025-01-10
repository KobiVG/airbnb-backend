// Importing the express module and other required packages
const express = require('express');
const multer = require('multer');
const path = require('path');
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

// Set up the storage engine for multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, 'uploads'));
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));






// Endpoints:

// Home endpoint
app.get('/', (req, res) => {
    res.send('Welcome to the Camping Booking API!');
});

// Get (username, email, role) using email
app.get('/api/users', async (req, res) => {
    const { email } = req.query;

    if (!email)
    {
        return res.status(400).json({ error: 'Email is required.' });
    }

    const db = new Database();

    try 
    {
        const userQuery = await db.getQuery('SELECT username, email, role FROM users WHERE email = ?', [email]);

        if (userQuery.length === 0) 
        {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.status(200).json(userQuery[0]);
    } 
    catch (error) 
    {
        res.status(500).json({ error: 'An error occurred while fetching user data.' });
    }
});

// Endpoint to fetch all camping spots
app.get("/api/camping-spots", async (req, res) => {
    const db = new Database();
    try 
    {
      const campingSpots = await db.getQuery(`
        SELECT
          camping_spot_id as id, 
          name, 
          description, 
          location, 
          image_path AS image, 
          price_per_night 
        FROM camping_spots
      `);
      res.status(200).json(campingSpots);
    } 
    catch (error) 
    {
      res.status(500).json({ error: "Error fetching camping spots." });
    }
});

// Endpoint to fetch all camping spots owned by a specific user
app.get('/api/owner-camping-spots/:userId', async (req, res) => {
    const { userId } = req.params;

    const db = new Database();

    try 
    {
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

        if (ownerCampingSpotsQuery.length === 0) 
        {
            return res.status(404).json({ message: "No camping spots found for this owner." });
        }

        res.status(200).json(ownerCampingSpotsQuery);
    } 
    catch (error) 
    {
        res.status(500).json({ error: "An error occurred while fetching the owner's camping spots." });
    }
});

// Endpoint to fetch all bookings of a specific user
app.get('/api/user-bookings/:userId', async (req, res) => {
    const { userId } = req.params;

    const db = new Database();
    try 
    {
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

        if (bookingsQuery.length === 0) 
        {
            return res.status(404).json({ message: "No bookings found for this user." });
        }

        res.status(200).json(bookingsQuery);
    } 
    catch (error) 
    {
        res.status(500).json({ error: 'An error occurred while fetching the bookings.' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) 
    {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    const db = new Database();

    try 
    {
        const userQuery = await db.getQuery('SELECT * FROM users WHERE email = ?', [email]);

        if (userQuery.length === 0) 
        {
            return res.status(401).json({ error: 'Incorrect email or password.' });
        }

        const user = userQuery[0];

        if (password !== user.password) 
        {
            return res.status(401).json({ error: 'Incorrect email or password.' });
        }

        const response = {
            message: 'Login successful',
            userId: user.user_id,
            username: user.username,
            email: user.email,
            role: user.role,
        };
        res.status(200).json(response);
    } 
    catch (error) 
    {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Register endpoint
app.post('/api/register', async (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) 
    {
        return res.status(400).json({ message: "All fields are required." });
    }

    const db = new Database();

    try 
    {
        const emailExists = await db.getQuery('SELECT * FROM users WHERE email = ?', [email]);

        if (emailExists.length > 0) 
        {
            return res.status(400).json({ message: "Email already in use." });
        }

        const query = `
            INSERT INTO users (username, email, password, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, NOW(), NOW())
        `;
        await db.getQuery(query, [username, email, password, role]);

        res.status(201).end();
    } 
    catch (error) 
    {
        res.status(500).json({ message: "Error registering user.", error: error.message });
    }
});

// Endpoint to handle adding new camping spots with image upload
app.post('/api/camping-spots', upload.single('image'), async (req, res) => {
    const imagePath = req.file ? `/uploads/${req.file.filename.replace(/\\/g, '/')}` : null;
    const db = new Database();

    const { name, description, location, price_per_night, owner_user_id } = req.body;

    if (!name || !description || !location || !price_per_night || !owner_user_id) 
    {
        return res.status(400).json({ error: "All fields are required, including owner_user_id." });
    }

    const sql = `
      INSERT INTO camping_spots (name, description, location, price_per_night, image_path, owner_user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    try 
    {
        await db.getQuery(sql, [name, description, location, price_per_night, imagePath, owner_user_id]);
        res.status(201).end();
    } 
    catch (error) 
    {
        res.status(500).json({ error: "Error adding camping spot." });
    }
});

// Add a new endpoint to handle bookings
app.post('/api/book-camping', async (req, res) => {
    const { userId, campingSpotId, checkInDate, checkOutDate } = req.body;

    if (!userId || !campingSpotId || !checkInDate || !checkOutDate) 
    {
        return res.status(400).json({ error: 'All fields are required for booking.' });
    }

    const db = new Database();

    try 
    {
        const bookingQuery = `
            INSERT INTO bookings (user_id, camping_spot_id, check_in_date, check_out_date, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'confirmed', NOW(), NOW())
        `;
        await db.getQuery(bookingQuery, [userId, campingSpotId, checkInDate, checkOutDate]);

        res.status(201).end();
    } 
    catch (error) 
    {
        res.status(500).json({ error: 'An error occurred while creating the booking.' });
    }
});

// Delete camping spot
app.delete('/api/camping-spot/:campingId', async (req, res) => {
    const { campingId } = req.params;
    const db = new Database();

    try 
    {
        await db.getQuery(`DELETE FROM reviews WHERE camping_spot_id = ?`, [campingId]);
        await db.getQuery(`DELETE FROM bookings WHERE camping_spot_id = ?`, [campingId]);
        await db.getQuery(`DELETE FROM availabilities WHERE camping_spot_id = ?`, [campingId]);

        const result = await db.getQuery(`DELETE FROM camping_spots WHERE camping_spot_id = ?`, [campingId]);

        if (result.affectedRows === 0) 
        {
            return res.status(404).json({ error: "Camping spot not found." });
        }

        res.status(200).json({ message: "Camping spot deleted successfully." });
    } 
    catch (error) 
    {
        res.status(500).json({ error: "Error deleting camping spot." });
    }
});

// Update user information endpoint
app.put('/api/users/:userId', async (req, res) => {
    const { userId } = req.params;
    const { username, email, role } = req.body;

    if (!username && !email && !role) 
    {
        return res.status(400).json({ error: 'At least one field must be provided for update.' });
    }

    const db = new Database();

    try 
    {
        const updates = [];
        const values = [];

        if (username) 
        {
            updates.push('username = ?');
            values.push(username);
        }
        if (email) 
        {
            updates.push('email = ?');
            values.push(email);
        }
        if (role) 
        {
            updates.push('role = ?');
            values.push(role);
        }

        values.push(userId); 
        const updateQuery = `
            UPDATE users 
            SET ${updates.join(', ')}, updated_at = NOW()
            WHERE user_id = ?
        `;
        const result = await db.getQuery(updateQuery, values);

        if (result.affectedRows === 0) 
        {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.status(200).json({ message: 'User information updated successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});




// Server setup
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
