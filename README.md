# CommSpace Social Media Website

## Description
CommSpace is a social media platform built with Node.js and Express. It provides users with a space to connect, share content, and interact with each other in a community-focused environment.

## Features
- User authentication and authorization
- Post creation and sharing
- File uploads
- Profile management
- Interactive user interface

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: (Your database choice)
- File Storage: Multer for handling file uploads

## Project Structure
```
├── config/
│   └── multer.js       # File upload configuration
├── css/
│   └── styles.css      # Styling
├── html/
│   └── index.html      # Main page
├── js/
│   └── posts.js        # Post handling logic
├── nodefiles/
│   ├── config/
│   │   └── database.js # Database configuration
│   └── routes/
│       └── auth.js     # Authentication routes
└── uploads/            # User uploaded files
```

## Installation
1. Clone the repository:
```bash
git clone https://github.com/yfyuky/CommSpace-Social-Media-Website.git
```

2. Install dependencies:
```bash
npm install
```

3. Set up your environment variables:
- Create a `.env` file in the root directory
- Add necessary environment variables

4. Start the server:
```bash
node server.js
```
