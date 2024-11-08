const express = require('express');
const { Client } = require('pg'); // PostgreSQL client for videos
const multer = require('multer'); // For handling file uploads
const mysql = require('mysql2'); // For handling MySQL for images
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml'); // For Swagger YAML support
const swaggerUi = require('swagger-ui-express'); // For Swagger UI

// Read and parse the swagger.yaml file using js-yaml
let swaggerDocument;
try {
  swaggerDocument = yaml.load(fs.readFileSync('./swagger.yaml', 'utf8'));
} catch (e) {
  console.log(e);
  process.exit(1);  // Exit the app if the swagger.yaml file is not valid
}

const app = express();
const port = 5000;
console.log('App starting...');
console.log('Hello world');

// MySQL connection for images
const mysqlDb = mysql.createConnection({
  host: 'mysql',
  user: 'root',
  password: 'password',
  database: 'image_db',
});

mysqlDb.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL database for images');

  // Create the images table if it doesn't exist
  mysqlDb.query(`
    CREATE TABLE IF NOT EXISTS images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      image_data LONGBLOB NOT NULL
    );
  `, (err, result) => {
    if (err) {
      console.error('Error creating images table:', err);
    } else {
      console.log('Images table checked/created successfully.');
    }
  });
});

// Connect to PostgreSQL for video storage
const client = new Client({
    host: 'postgres',
    user: 'postgres',
    password: 'password',
    database: 'video_db',
    port: 5432
  });
  
  client.connect((err) => {
    if (err) {
      console.error('Failed to connect to PostgreSQL:', err.stack);
      console.log('Hello failed');
    } else {
      console.log('Connected to PostgreSQL');
    }
  });
  
  // Create the videos table if it doesn't exist
  client.query(`
    CREATE TABLE IF NOT EXISTS videos (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      video_data BYTEA NOT NULL
    );
  `, (err) => {
    if (err) {
      console.error('Error creating videos table:', err);
    } else {
      console.log('Videos table checked/created successfully.');
    }
  });

// Swagger UI setup
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Automatically upload videos from the 'videos' directory to PostgreSQL
const uploadVideosFromDirectory = () => {
  const videoDir = './videos'; // Directory containing videos

  fs.readdir(videoDir, (err, files) => {
    if (err) {
      console.error('Error reading video directory:', err);
      return;
    }

    if (files.length === 0) {
      console.log('No video files found in the directory.');
      return;
    }

    files.forEach(file => {
      const filePath = path.join(videoDir, file);
      if (path.extname(file) === '.MOV' || path.extname(file) === '.mp4') {
        fs.readFile(filePath, (err, data) => {
          if (err) {
            console.error('Error reading video file:', err);
            return;
          }

          // Insert video into PostgreSQL database
          const query = 'INSERT INTO videos (filename, video_data) VALUES ($1, $2)';
          const values = [file, data];

          client.query(query, values, (err, result) => {
            if (err) {
              console.error('Error uploading video to PostgreSQL:', err);
            } else {
              console.log(`Video ${file} uploaded successfully to PostgreSQL.`);
            }
          });
        });
      } else {
        console.log(`Skipping non-video file: ${file}`);
      }
    });
  });
};

// Automatically upload videos when the server starts
uploadVideosFromDirectory();

// Automatically upload images from the 'images' directory to MySQL
const uploadImagesFromDirectory = () => {
    const imageDir = './images'; // Directory containing images
  
    fs.readdir(imageDir, (err, files) => {
      if (err) {
        console.error('Error reading image directory:', err);
        return;
      }
  
      files.forEach(file => {
        const filePath = path.join(imageDir, file);
        if (['.jpg', '.jpeg', '.png'].includes(path.extname(file))) {
          fs.readFile(filePath, (err, data) => {
            if (err) {
              console.error('Error reading image file:', err);
              return;
            }
  
            // Insert image into MySQL database
            const query = 'INSERT INTO images (image_data) VALUES (?)';
            mysqlDb.query(query, [data], (err, result) => {
              if (err) {
                console.error('Error uploading image to MySQL:', err);
              } else {
                console.log(`Image ${file} uploaded successfully to MySQL.`);
              }
            });
          });
        }
      });
    });
  };
  
  // Automatically upload images when the server starts
  uploadImagesFromDirectory();
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); // Ensure index.html is in the 'public' folder
  });
  

// API to fetch list of video files in the database
app.get('/videos', async (req, res) => {
  try {
    const result = await client.query('SELECT id, filename FROM videos');
    res.json({ videos: result.rows });
  } catch (err) {
    console.error('Failed to fetch videos:', err);
    res.status(500).json({ message: 'Failed to fetch videos' });
  }
});

// Fetch video by ID from PostgreSQL
app.get('/videos/:id', (req, res) => {
  const videoId = req.params.id;
  client.query('SELECT filename, video_data FROM videos WHERE id = $1', [videoId], (err, result) => {
    if (err) {
      console.error('Error fetching video:', err);
      return res.status(500).json({ message: 'Error fetching video' });
    }
    if (result.rows.length > 0) {
      const file = result.rows[0];
      res.set('Content-Type', 'video/mp4');
      res.send(file.video_data);
    } else {
      res.status(404).json({ message: 'Video not found' });
    }
  });
});


// Fetch Images API (from MySQL)
app.get('/images', (req, res) => {
  mysqlDb.query('SELECT id FROM images', (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to fetch images' });
    }
    res.json({ images: results });
  });
});

// Fetch Image by ID from MySQL
app.get('/images/:id', (req, res) => {
  const imageId = req.params.id;
  mysqlDb.query('SELECT image_data FROM images WHERE id = ?', [imageId], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Failed to fetch image' });
    }
    if (results.length > 0) {
      res.contentType('image/jpeg');
      res.send(results[0].image_data);
    } else {
      res.status(404).json({ message: 'Image not found' });
    }
  });
});

// Start the server
app.listen(port, function () {
  console.log(`App listening on port ${port}!`);
});
