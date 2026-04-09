# 📺 YouTube Backend API

## 🚀 Project Overview
A scalable backend system for a video-sharing platform built using **Node.js**, **Express.js**, and **MongoDB**.  
This project handles core functionalities like user authentication, video management, likes, comments, and playlists.

---

## 🛠️ Tech Stack
- **Backend:** Node.js, Express.js  
- **Database:** MongoDB (Mongoose)  
- **Authentication:** JWT (JSON Web Tokens)  
- **File Uploads:** Cloudinary  
- **Tools:** Postman, Git

---

## ✨ Features
- 👤 User Registration & Login  
- 🎥 Upload & Manage Videos  
- 👍 Like / Unlike Videos  
- 💬 Comment System  
- 📂 Playlist Management  
- 🔐 Protected Routes using Middleware  
- ⚡ RESTful API Design  

---

## 📁 Project Structure
```bash
src/
│
├── controllers/
├── routes/
├── models/
├── middlewares/
├── utils/
└── app.js
```

---

## ⚙️ Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/your-username/youtube-backend.git
cd youtube-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Create .env file
```env
PORT=5000
MONGODB_URI=your_mongodb_connection
ACCESS_TOKEN_SECRET=your_secret
REFRESH_TOKEN_SECRET=your_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 4. Run the server
```bash
npm run dev
```

---

## 📌 API Endpoints

| Method | Endpoint | Description |
|--------|---------|------------|
| POST   | /api/v1/users/register | Register user |
| POST   | /api/v1/users/login   | Login user |
| GET    | /api/v1/videos        | Get all videos |
| POST   | /api/v1/videos        | Upload video |
| POST   | /api/v1/likes/toggle  | Like/Unlike video |

---

## 🔐 Authentication
- JWT-based authentication  
- Access & Refresh Tokens  
- Middleware protected routes  

---

## 📷 Future Improvements
- Search & Filter  
- Improved Dashboard  
- Frontend Integration  
- Notification System  
