require('dotenv').config(); // Load environment variables

const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs'); // Use bcryptjs consistently
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = 5000;

// MySQL Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'constructionmanagement',
});

db.connect((err) => {
  if (err) {
    console.error("Database Connection Error:", err);
    throw err;
  }
  console.log('Connected nas database nimo bugo!');
});

/*********************************************** User Authentication *****************************************/

// User Registration
app.post('/api/register', (req, res) => {
  const { name, email, password, role } = req.body;

  db.query('SELECT * FROM Users WHERE email = ?', [email], (err, result) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (result.length > 0) return res.status(400).json({ message: 'User already exists' });

    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error("Hashing Error:", err);
        return res.status(500).json({ message: 'Error hashing password' });
      }

      const query = 'INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)';
      db.query(query, [name, email, hashedPassword, role], (err, result) => {
        if (err) {
          console.error("Database Error:", err);
          return res.status(500).json({ message: 'Database error' });
        }
        res.status(201).json({ message: 'User registered successfully' });
      });
    });
  });
});

// User Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM Users WHERE email = ?";

  db.query(sql, [email], async (err, result) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }

    if (result.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result[0];

    try {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.user_id, role: user.role },
        process.env.JWT_SECRET || "your_secret_key",
        { expiresIn: "1h" }
      );

      res.json({ token, role: user.role, user_id: user.user_id });

    } catch (bcryptError) {
      console.error("Bcrypt Error:", bcryptError);
      return res.status(500).json({ message: "Error verifying password" });
    }
  });
});

// Get All Users
app.get('/api/users', (req, res) => {
  db.query('SELECT user_id, name, email, role, created_at FROM Users', (err, result) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(result);
  });
});

// Delete a User
app.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  const query = 'DELETE FROM Users WHERE user_id = ?';

  db.query(query, [userId], (err, result) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  });
});

// Update a User
app.put('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  const { name, email, role } = req.body;
  const query = 'UPDATE Users SET name = ?, email = ?, role = ? WHERE user_id = ?';

  db.query(query, [name, email, role, userId], (err, result) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully' });
  });
});


/*********************************************** Projects *****************************************/

// Create a new project
app.post('/api/projects', (req, res) => {
    console.log("Received Data:", req.body);
  
    let { name, description, owner_id, start_date, end_date, status } = req.body;
  
    if (!name || !description || !owner_id || !start_date || !end_date || !status) {
      return res.status(400).json({ message: 'All fields are required' });
    }
  
    owner_id = parseInt(owner_id);
    if (isNaN(owner_id)) {
      return res.status(400).json({ message: 'Invalid owner_id. Must be a number.' });
    }
  
    const isValidDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date);
    if (!isValidDate(start_date) || !isValidDate(end_date)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
    }
  
    const validStatuses = ['Pending', 'Ongoing', 'Completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }
  
    const query = `INSERT INTO Projects (name, description, owner_id, start_date, end_date, status) 
                   VALUES (?, ?, ?, ?, ?, ?)`;
  
    db.query(query, [name, description, owner_id, start_date, end_date, status], (err, result) => {
      if (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ message: 'Database error', error: err.sqlMessage });
      }
  
      // Return the new project ID to auto-select in the task form
      res.status(201).json({ 
        message: 'Project created successfully', 
        projectId: result.insertId 
      });
    });
  });
  
  // Get All Projects
  app.get('/api/projects', (req, res) => {
    db.query('SELECT * FROM Projects', (err, result) => {
      if (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(result);
    });
  });
  
  // Get a Single Project by ID
  app.get('/api/projects/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT * FROM Projects WHERE project_id = ?', [id], (err, result) => {
      if (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(result[0]);
    });
  });
  
  // Get Projects by Owner ID (for Task Form Dropdown)
  app.get('/api/projects/owner/:owner_id', (req, res) => {
    const { owner_id } = req.params;
    
    db.query('SELECT project_id, name FROM Projects WHERE owner_id = ?', [owner_id], (err, result) => {
      if (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(result);
    });
  });

 // Delete a project
app.delete('/api/projects/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM Projects WHERE project_id = ?', [id], (err, result) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ message: 'Database error' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully' });
  });
});

// Update a project
app.put('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  let { name, description, owner_id, start_date, end_date, status } = req.body;

  if (!name || !description || !owner_id || !start_date || !end_date || !status) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  owner_id = parseInt(owner_id);
  if (isNaN(owner_id)) {
    return res.status(400).json({ message: 'Invalid owner_id. Must be a number.' });
  }

  db.query(
    `UPDATE Projects SET name = ?, description = ?, owner_id = ?, start_date = ?, end_date = ?, status = ? WHERE project_id = ?`,
    [name, description, owner_id, start_date, end_date, status, id],
    (err, result) => {
      if (err) {
        console.error("Database Error:", err);
        return res.status(500).json({ message: 'Database error' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Fetch the updated project to return to frontend
      db.query('SELECT * FROM Projects WHERE project_id = ?', [id], (err, updatedResult) => {
        if (err) {
          return res.status(500).json({ message: 'Database error' });
        }
        res.json({ message: 'Project updated successfully', updatedProject: updatedResult[0] });
      });
    }
  );
});

  

/*********************************************** Tasks *****************************************/

// Get all tasks
app.get("/api/tasks", (req, res) => {
    db.query("SELECT * FROM Tasks", (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// Create a task
app.post("/api/tasks", (req, res) => {
    const { project_id, title, description, assigned_to, due_date, status } = req.body;
    db.query(
        "INSERT INTO Tasks (project_id, title, description, assigned_to, due_date, status) VALUES (?, ?, ?, ?, ?, ?)",
        [project_id, title, description, assigned_to, due_date, status],
        (err, result) => {
            if (err) return res.status(500).json(err);
            res.json({ message: "Task created successfully" });
        }
    );
});

// Update a task
app.put("/api/tasks/:id", (req, res) => {
    const { title, description, assigned_to, due_date, status } = req.body;
    db.query(
        "UPDATE Tasks SET title=?, description=?, assigned_to=?, due_date=?, status=? WHERE task_id=?",
        [title, description, assigned_to, due_date, status, req.params.id],
        (err, result) => {
            if (err) return res.status(500).json(err);
            res.json({ message: "Task updated successfully" });
        }
    );
});

// Delete a task
app.delete("/api/tasks/:id", (req, res) => {
    db.query("DELETE FROM Tasks WHERE task_id=?", [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Task deleted successfully" });
    });
});


// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
