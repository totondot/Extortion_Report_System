const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '')));

// In-memory session store (for demonstration purposes)
const sessions = {};

// Route to serve the user authentication page at the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'auth.html'));
});

// Route to serve the extortion complaint form at the complaints URL
app.get('/complaint-form', (req, res) => {
    res.sendFile(path.join(__dirname, 'extortion_complaint.html'));
});

// New route to serve the home page
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

// MySQL Connection Pool
const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'extortion_report_system'
});

// API endpoint to handle login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    const sql = 'SELECT UserID, Name FROM User WHERE Email = ? AND Password = ?';
    const values = [email, password];

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            return res.status(500).json({ success: false, message: 'Database connection error.' });
        }

        connection.query(sql, values, (err, results) => {
            connection.release();
            if (err) {
                console.error('Error querying database:', err);
                return res.status(500).json({ success: false, message: 'An error occurred during login.' });
            }

            if (results.length > 0) {
                const user = results[0];
                const sessionId = crypto.randomUUID();
                sessions[sessionId] = { userId: user.UserID };

                console.log('User logged in successfully:', user.Name);
                // Return a redirectTo field to be handled by the client-side JavaScript
                res.status(200).json({ success: true, message: 'Login successful!', userId: user.UserID, sessionId, redirectTo: '/home' });
            } else {
                res.status(401).json({ success: false, message: 'Invalid email or password.' });
            }
        });
    });
});

// API endpoint to handle signup
app.post('/api/signup', (req, res) => {
    const { name, email, password } = req.body;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            console.error('Database connection error details:', err.stack);
            return res.status(500).json({ success: false, message: 'Database connection error.' });
        }

        connection.query('SELECT UserID FROM User WHERE Email = ?', [email], (err, results) => {
            if (err) {
                connection.release();
                console.error('Error checking for existing user:', err);
                console.error('Query error details:', err.stack);
                return res.status(500).json({ success: false, message: 'An error occurred during signup.' });
            }

            if (results.length > 0) {
                connection.release();
                return res.status(409).json({ success: false, message: 'Email already registered.' });
            }

            const sql = 'INSERT INTO User (Name, Email, Password) VALUES (?, ?, ?)';
            const values = [name, email, password];

            connection.query(sql, values, (err, result) => {
                connection.release();
                if (err) {
                    console.error('Error inserting new user:', err);
                    console.error('Insertion error details:', err.stack);
                    return res.status(500).json({ success: false, message: 'Failed to create a new account.' });
                }

                console.log('New user created successfully. User ID:', result.insertId);
                res.status(201).json({ success: true, message: 'User registered successfully!' });
            });
        });
    });
});

// API endpoint to handle form submissions
app.post('/api/submit-complaint', (req, res) => {
    const { incidentDate, location, description, sessionId } = req.body;

    const session = sessions[sessionId];
    if (!session) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No active session.' });
    }

    const userId = session.userId;

    const sql = 'INSERT INTO `Case` (UserID, ReportDate, IncidentDate, Description, Location) VALUES (?, ?, ?, ?, ?)';
    const values = [userId, new Date().toISOString().slice(0, 10), incidentDate, description, location];

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            return res.status(500).json({ success: false, message: 'Database connection error.' });
        }

        connection.query(sql, values, (err, result) => {
            connection.release();
            if (err) {
                console.error('Error inserting data into database:', err);
                return res.status(500).json({ success: false, message: 'Failed to submit complaint.' });
            }

            console.log('Complaint submitted successfully. Case ID:', result.insertId);
            res.status(200).json({ success: true, message: 'Complaint submitted successfully!' });
        });
    });
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
