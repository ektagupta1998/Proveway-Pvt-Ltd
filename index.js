const express = require('express');
const app = express();
const { google } = require('googleapis');
const drive = google.drive('v3');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const querystring = require('querystring');
const CHUNK_SIZE = 1024 * 1024; // Chunk size is 1MB


const YOUR_CLIENT_ID = '795422667276-0pa15jugr7kek9a9vg170689mq2io9n9.apps.googleusercontent.com';
const YOUR_CLIENT_SECRET = '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';
const YOUR_REDIRECT_URL = 'http://localhost:3000';

// Initialize Google Drive API
const oauth2Client = new google.auth.OAuth2(
  YOUR_CLIENT_ID,
  YOUR_CLIENT_SECRET,
  YOUR_REDIRECT_URL
);
google.options({ auth: oauth2Client });


app.get('/get-token', async (req, res) => {
  const code = req.query.code;

  const { data } = await axios.post('https://oauth2.googleapis.com/token', querystring.stringify({
    code,
    client_id: YOUR_CLIENT_ID,
    client_secret: YOUR_CLIENT_SECRET,
    redirect_uri: YOUR_REDIRECT_URL,
    grant_type: 'authorization_code'
  }), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  oauth2Client.setCredentials(data);
  res.send('Authentication successful! Please return to the console.');
});

app.get('/download-upload', async (req, res) => {
  const fileId = req.query.fileId;
  const destId = req.query.destId;

  const dest = fs.createWriteStream(`/tmp/${fileId}`);
  let progress = 0;

  drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  ).then(response => {
    response.data
      .on('end', () => {
        console.log('Done downloading file.');
        uploadFile(destId, `/tmp/${fileId}`);
      })
      .on('error', err => {
        console.error('Error downloading file.');
        return res.status(500).send(err.toString());
      })
      .on('data', d => {
        progress += d.length;
        if (process.stdout.isTTY) {
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
          process.stdout.write(`Downloaded ${progress} bytes`);
        }
      })
      .pipe(dest);
  });
});

function uploadFile(parentId, filePath) {
  const fileSize = fs.statSync(filePath).size;
  drive.files.create({
    requestBody: {
      name: path.basename(filePath),
      parents: [parentId]
    },
    media: {
      body: fs.createReadStream(filePath)
    }
  }, {
    // Use the `onUploadProgress` event to track the upload status
    onUploadProgress: evt => {
      const progress = (evt.bytesRead / fileSize) * 100;
      console.log(`${progress}% uploaded`);
    }
  }).then(res => {
    console.log('Upload finished');
  }).catch(err => {
    console.error('Error during upload', err);
  });
}

app.listen(3000, () => console.log('App listening on port 3000!'));