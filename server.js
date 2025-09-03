const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
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

// Route to serve the user home page
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

// Route to serve the extortion complaint form at the complaints URL
app.get('/complaint-form', (req, res) => {
    res.sendFile(path.join(__dirname, 'extortion_complaint.html'));
});

// Route to serve the extortion reports page
app.get('/extortion-reports', (req, res) => {
    res.sendFile(path.join(__dirname, 'view-complaints.html'));
});

// Route to serve the report analysis page
app.get('/report-analysis', (req, res) => {
    res.sendFile(path.join(__dirname, 'report-analysis.html'));
});

// Route to serve the chat page
app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'chat.html'));
});

// Route to serve the user profile page
app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'profile.html'));
});

// Route to serve the emergency alert page
app.get('/emergency-alert', (req, res) => {
    res.sendFile(path.join(__dirname, 'emergency_alert.html'));
});

// Route to serve the view-emergency-alerts page
app.get('/view-emergency-alerts', (req, res) => {
    res.sendFile(path.join(__dirname, 'view-emergency-alerts.html'));
});

// Route to serve the success-stories page
app.get('/success-stories', (req, res) => {
    res.sendFile(path.join(__dirname, 'success_stories.html'));
});

// Route to serve the success story submission page
app.get('/submit-success-story', (req, res) => {
    res.sendFile(path.join(__dirname, 'submit_success_story.html'));
});

// Route to serve the legal awareness page 🆕
app.get('/legal-awareness', (req, res) => {
    res.sendFile(path.join(__dirname, 'legal_awareness.html'));
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

    const sql = 'SELECT UserID, Name, UserType FROM User WHERE Email = ? AND Password = ?';
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
                sessions[sessionId] = { userId: user.UserID, userType: user.UserType };

                console.log('User logged in successfully:', user.Name);
                res.status(200).json({ success: true, message: 'Login successful!', redirectTo: '/home', sessionId });
            } else {
                res.status(401).json({ success: false, message: 'Invalid email or password.' });
            }
        });
    });
});

// API endpoint to handle signup
app.post('/api/signup', (req, res) => {
    const { name, email, password, userType } = req.body;

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

            const sql = 'INSERT INTO User (Name, Email, Password, UserType) VALUES (?, ?, ?, ?)';
            const values = [name, email, password, userType];

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

// API endpoint to handle session retrieval
app.post('/api/get-session', (req, res) => {
    const { sessionId } = req.body;
    const session = sessions[sessionId];

    if (session) {
        res.status(200).json({ success: true, session });
    } else {
        res.status(404).json({ success: false, message: 'Session not found.' });
    }
});

// API endpoint to retrieve user profile data
app.post('/api/get-user-profile', (req, res) => {
    const { sessionId } = req.body;
    const session = sessions[sessionId];

    if (!session) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No active session.' });
    }

    const userId = session.userId;
    const sql = 'SELECT UserID, Name, Email FROM User WHERE UserID = ?';

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            return res.status(500).json({ success: false, message: 'Database connection error.' });
        }

        connection.query(sql, [userId], (err, results) => {
            connection.release();
            if (err) {
                console.error('Error querying database for user profile:', err);
                return res.status(500).json({ success: false, message: 'Failed to retrieve user data.' });
            }

            if (results.length > 0) {
                res.status(200).json({ success: true, user: results[0] });
            } else {
                res.status(404).json({ success: false, message: 'User not found.' });
            }
        });
    });
});

// API endpoint to retrieve all reports with status
app.post('/api/my-complaints', (req, res) => {
    const { sessionId } = req.body;
    const session = sessions[sessionId];

    if (!session) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No active session.' });
    }

    const sql = `
        SELECT
            C.CaseID,
            C.UserID,
            C.ReportDate,
            C.IncidentDate,
            C.Location,
            C.Description,
            COALESCE(S.Status, 'Pending') AS Status
        FROM
            \`Case\` AS C
        LEFT JOIN
            CaseStatus AS S ON C.CaseID = S.CaseID
    `;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            return res.status(500).json({ success: false, message: 'Database connection error.' });
        }
        connection.query(sql, (err, results) => {
            connection.release();
            if (err) {
                console.error('Error querying database:', err);
                return res.status(500).json({ success: false, message: 'Failed to retrieve complaints.' });
            }
            res.status(200).json({ success: true, complaints: results, userType: session.userType, userId: session.userId });
        });
    });
});

// API endpoint to handle complaint deletion
app.post('/api/delete-complaint', (req, res) => {
    const { caseId, sessionId } = req.body;
    const session = sessions[sessionId];

    if (!session) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No active session.' });
    }

    const { userId } = session;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            return res.status(500).json({ success: false, message: 'Database connection error.' });
        }

        connection.beginTransaction(err => {
            if (err) {
                connection.release();
                console.error('Error starting transaction:', err);
                return res.status(500).json({ success: false, message: 'Failed to delete complaint.' });
            }

            const verifySql = 'SELECT UserID FROM `Case` WHERE CaseID = ?';
            connection.query(verifySql, [caseId], (err, results) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release();
                        console.error('Error verifying complaint ownership:', err);
                        res.status(500).json({ success: false, message: 'Failed to delete complaint.' });
                    });
                }

                if (results.length === 0 || results[0].UserID !== userId) {
                    return connection.rollback(() => {
                        connection.release();
                        res.status(403).json({ success: false, message: 'Forbidden: You can only delete your own complaints.' });
                    });
                }

                const deleteStatusSql = 'DELETE FROM CaseStatus WHERE CaseID = ?';
                connection.query(deleteStatusSql, [caseId], (err) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error('Error deleting from CaseStatus:', err);
                            res.status(500).json({ success: false, message: 'Failed to delete complaint.' });
                        });
                    }

                    const deleteCaseSql = 'DELETE FROM `Case` WHERE CaseID = ?';
                    connection.query(deleteCaseSql, [caseId], (err) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                console.error('Error deleting from Case:', err);
                                res.status(500).json({ success: false, message: 'Failed to delete complaint.' });
                            });
                        }

                        connection.commit(err => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    console.error('Error committing transaction:', err);
                                    res.status(500).json({ success: false, message: 'Failed to delete complaint.' });
                                });
                            }
                            connection.release();
                            res.status(200).json({ success: true, message: 'Complaint deleted successfully.' });
                        });
                    });
                });
            });
        });
    });
});

// API endpoint for updating complaint status
app.post('/api/update-status', (req, res) => {
    const { caseId, newStatus, sessionId } = req.body;
    const session = sessions[sessionId];

    if (!session || session.userType !== 'law enforcement') {
        return res.status(403).json({ success: false, message: 'Forbidden: Only law enforcement can update case status.' });
    }

    const sql = "REPLACE INTO `CaseStatus` (CaseID, Status) VALUES (?, ?)";
    const values = [caseId, newStatus];

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            return res.status(500).json({ success: false, message: 'Database connection error.' });
        }

        connection.query(sql, values, (err, result) => {
            connection.release();
            if (err) {
                console.error('Error updating case status:', err);
                return res.status(500).json({ success: false, message: 'Failed to update case status.' });
            }
            res.status(200).json({ success: true, message: 'Case status updated successfully.' });
        });
    });
});

// API endpoint for emergency alerts
app.post('/api/emergency-alert', (req, res) => {
    const { latitude, longitude, sessionId } = req.body;
    const session = sessions[sessionId];

    if (!session) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No active session.' });
    }

    const userId = session.userId;
    const sql = `
        INSERT INTO EmergencyAlerts (UserID, Latitude, Longitude, Timestamp)
        VALUES (?, ?, ?, NOW())
    `;
    const values = [userId, latitude, longitude];

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            return res.status(500).json({ success: false, message: 'Database connection error.' });
        }

        connection.query(sql, values, (err, result) => {
            connection.release();
            if (err) {
                console.error('Error inserting emergency alert:', err);
                return res.status(500).json({ success: false, message: 'Failed to log emergency alert.' });
            }
            res.status(200).json({ success: true, message: 'Emergency alert logged successfully.' });
        });
    });
});

// API endpoint to handle success story submission
app.post('/api/submit-success-story', (req, res) => {
    const { title, story, caseId, sessionId } = req.body;
    const session = sessions[sessionId];

    if (!session || session.userType !== 'citizen') {
        return res.status(403).json({ success: false, message: 'Forbidden: Only citizens can submit success stories.' });
    }

    // Check if the caseId exists and belongs to the user
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            return res.status(500).json({ success: false, message: 'Database connection error.' });
        }

        const verifySql = 'SELECT UserID FROM `Case` WHERE CaseID = ? AND UserID = ?';
        connection.query(verifySql, [caseId, session.userId], (err, results) => {
            if (err) {
                connection.release();
                console.error('Error verifying case ownership:', err);
                return res.status(500).json({ success: false, message: 'Failed to verify case.' });
            }

            if (results.length === 0) {
                connection.release();
                return res.status(403).json({ success: false, message: 'You can only submit stories for your own valid cases.' });
            }

            // Insert the new success story
            const insertSql = 'INSERT INTO SuccessStories (Title, Story, CaseID, DateAdded) VALUES (?, ?, ?, CURDATE())';
            connection.query(insertSql, [title, story, caseId], (err, result) => {
                connection.release();
                if (err) {
                    console.error('Error inserting success story:', err);
                    return res.status(500).json({ success: false, message: 'Failed to submit success story.' });
                }
                res.status(200).json({ success: true, message: 'Success story submitted successfully!' });
            });
        });
    });
});

// API endpoint to retrieve all emergency alerts
app.get('/api/emergency-alerts', (req, res) => {
    const sql = `SELECT UserID, Latitude, Longitude, Timestamp FROM EmergencyAlerts ORDER BY Timestamp DESC`;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            return res.status(500).json({ success: false, message: 'Database connection error.' });
        }
        connection.query(sql, (err, results) => {
            connection.release();
            if (err) {
                console.error('Error querying emergency alerts:', err);
                return res.status(500).json({ success: false, message: 'Failed to retrieve emergency alerts.' });
            }
            res.status(200).json({ success: true, alerts: results });
        });
    });
});

// API endpoint for report analysis by location
app.get('/api/report-analysis', (req, res) => {
    const sql = `
        SELECT Location, COUNT(*) as reportCount
        FROM \`Case\`
        GROUP BY Location
    `;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            return res.status(500).json({ success: false, message: 'Database connection error.' });
        }

        connection.query(sql, (err, results) => {
            connection.release();
            if (err) {
                console.error('Error querying database:', err);
                return res.status(500).json({ success: false, message: 'Failed to retrieve report analysis data.' });
            }
            res.status(200).json({ success: true, data: results });
        });
    });
});

// API endpoint for report analysis by status
app.get('/api/report-status-analysis', (req, res) => {
    const sql = `
        SELECT COALESCE(S.Status, 'Pending') AS Status, COUNT(*) AS reportCount
        FROM \`Case\` AS C
        LEFT JOIN CaseStatus AS S ON C.CaseID = S.CaseID
        GROUP BY S.Status
    `;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            return res.status(500).json({ success: false, message: 'Database connection error.' });
        }

        connection.query(sql, (err, results) => {
            connection.release();
            if (err) {
                console.error('Error querying database:', err);
                return res.status(500).json({ success: false, message: 'Failed to retrieve report status analysis data.' });
            }
            res.status(200).json({ success: true, data: results });
        });
    });
});

// API endpoint for retrieving success stories
app.get('/api/success-stories', (req, res) => {
    const sql = `
        SELECT * FROM SuccessStories ORDER BY DateAdded DESC
    `;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            return res.status(500).json({ success: false, message: 'Database connection error.' });
        }

        connection.query(sql, (err, results) => {
            connection.release();
            if (err) {
                console.error('Error querying success stories:', err);
                return res.status(500).json({ success: false, message: 'Failed to retrieve success stories.' });
            }
            res.status(200).json(results);
        });
    });
});

// API endpoint to serve hardcoded legal resources 🆕
app.get('/api/legal-resources', (req, res) => {
    const legalResources = [
        {
            title: "What is Extortion?",
            description: "An overview of what constitutes the crime of extortion under the law.",
            url: "https://www.law.cornell.edu/wex/extortion",
            imageUrl: "https://images.unsplash.com/photo-1579203678036-2244243b7473"
        },
        {
            title: "Your Rights as a Citizen",
            description: "Learn about your fundamental rights and protections when interacting with law enforcement.",
            url: "https://www.aclu.org/know-your-rights",
            imageUrl: "https://images.unsplash.com/photo-1590240974868-b71887e2213d"
        },
        {
            title: "Cybercrime Laws",
            description: "A summary of key laws and regulations aimed at preventing and prosecuting cybercrimes.",
            url: "https://www.justice.gov/criminal-ccips/data-privacy-and-security",
            imageUrl: "https://images.unsplash.com/photo-1510511459019-517361840000"
        },
        {
            title: "How to Report a Crime",
            description: "Step-by-step guidance on the proper procedures for reporting a crime to authorities.",
            url: "https://www.usa.gov/report-crime",
            imageUrl: "https://images.unsplash.com/photo-1574888879611-e40ae466e33f"
        }
    ];
    res.status(200).json(legalResources);
});
// API endpoint to create a new case specifically for a chat
app.post('/api/create-new-chat', (req, res) => {
    const { sessionId } = req.body;

    const session = sessions[sessionId];
    if (!session) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No active session.' });
    }

    const userId = session.userId;
    const reportDate = new Date().toISOString().slice(0, 10);
    const description = "Chat with Officer";
    const location = "N/A"; // Location is not relevant for chat cases

    const sql = 'INSERT INTO `Case` (UserID, ReportDate, IncidentDate, Description, Location) VALUES (?, ?, ?, ?, ?)';
    const values = [userId, reportDate, reportDate, description, location];

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err);
            return res.status(500).json({ success: false, message: 'Database connection error.' });
        }

        connection.query(sql, values, (err, result) => {
            connection.release();
            if (err) {
                console.error('Error creating new chat case:', err);
                return res.status(500).json({ success: false, message: 'Failed to create new chat session.' });
            }

            console.log('New chat case created. Case ID:', result.insertId);
            res.status(200).json({ success: true, caseId: result.insertId, message: 'New chat session created.' });
        });
    });
});
// Socket.IO event handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // When a user joins a chat, they join a specific room
    socket.on('joinCase', (caseId) => {
        socket.join(caseId);
        console.log(`User ${socket.id} joined chat room: ${caseId}`);
        
        // Fetch and send the chat history for this case
        const sql = `
            SELECT SenderType, Message FROM ChatMessages WHERE CaseID = ? ORDER BY Timestamp ASC
        `;
        pool.getConnection((err, connection) => {
            if (err) {
                console.error('Error getting connection from pool:', err);
                return;
            }
            connection.query(sql, [caseId], (err, messages) => {
                connection.release();
                if (err) {
                    console.error('Error fetching chat history:', err);
                    return;
                }
                socket.emit('chatHistory', messages);
            });
        });
    });

    // When a new message is received
    socket.on('sendMessage', (data) => {
        const { caseId, senderType, message } = data;
        
        // Save the message to the database
        const sql = `
            INSERT INTO ChatMessages (CaseID, SenderType, Message)
            VALUES (?, ?, ?)
        `;
        pool.getConnection((err, connection) => {
            if (err) {
                console.error('Error getting connection from pool:', err);
                return;
            }
            connection.query(sql, [caseId, senderType, message], (err, result) => {
                connection.release();
                if (err) {
                    console.error('Error saving message to database:', err);
                    return;
                }
                // Broadcast the message to all users in the same case room
                io.to(caseId).emit('newMessage', { senderType, message });
            });
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
