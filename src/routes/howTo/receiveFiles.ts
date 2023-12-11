/**
 * @file Demonstrates how to set up an endpoint that receives files using Express and Multer.
 * Also provides an example of how to send files to this endpoint using Axios.
 * @author Sebastian Gadzinski
 */

//
// SERVER SETUP
//

// Dependency Information:
// Make sure to install `multer` before setting up the server.
// You can install it via npm: `npm i multer`

// Code Sample:
// import express from 'express';
// import multer from 'multer';

// const router = express.Router();

// Configure multer storage to hold files in memory.
// const storage = multer.memoryStorage();
// const upload = multer({ storage });

// Set up the endpoint.
// router.post(
//   '/route',
//   isAuthenticated,
//   upload.fields([
//     { name: 'fileType1', maxCount: 1 },
//     { name: 'fileType2', maxCount: 5 },
//   ]),
//   DataController.route
// );

//
// SENDING FILES TO ENDPOINT
//

// Example Axios Request:
// const formData = new FormData();
// for (const file of files) {
//   formData.append('file', file);
// }
// let response = await api.post('/route', formData, {
//   headers: { 'Content-Type': 'multipart/form-data' },
//   responseType: 'blob',
//   timeout: 600000
// });
