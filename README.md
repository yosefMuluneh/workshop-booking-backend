# Workshop Booking System - Backend API

![Node.js](https://img.shields.io/badge/Node.js-18.x-green?style=for-the-badge&logo=node.js)
![Express.js](https://img.shields.io/badge/Express.js-4.x-black?style=for-the-badge&logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-blue?style=for-the-badge&logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-5.x-darkblue?style=for-the-badge&logo=prisma)
![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=for-the-badge&logo=docker)
![Jest](https://img.shields.io/badge/Tested_With-Jest-99424f?style=for-the-badge&logo=jest)

This repository contains the backend server for the Workshop Booking System. It is a robust Node.js and Express.js application built following clean architecture principles, providing a complete RESTful API for managing users, workshops, and bookings.

---

### ➤ Live API Base URL

`https://workshop-booking-backend.onrender.com`

---

### ✨ Core Features

-   **Secure Authentication**: JWT-based authentication for both customers and admins.
-   **Role-Based Access Control**: Differentiated API access for public, customer, and admin roles.
-   **Complete CRUD Operations**: Full management of workshops, time slots, and bookings.
-   **Data-Rich Dashboard**: A dedicated endpoint to supply aggregated statistics for the admin dashboard.
-   **Soft Deletion**: Workshops and bookings are soft-deleted to preserve data integrity.
-   **Robust Security**: Includes rate limiting, security headers with Helmet, and comprehensive input validation with Zod.
-   **Scalable Architecture**: Modular structure with separated routes, controllers, and validation logic.

---

### 🛠️ Tech Stack

| Category         | Technology / Library                                       |
| ---------------- | ---------------------------------------------------------- |
| **Framework**    | Node.js, Express.js                                        |
| **Database ORM** | Prisma                                                     |
| **Database**     | PostgreSQL                                                 |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` for hashing |
| **Validation**   | Zod                                                        |
| **Security**     | Helmet, Express Rate Limit, CORS                           |
| **Logging**      | Morgan                                                     |
| **Testing**      | Jest & Supertest                                           |
| **Deployment**   | Docker                                                     |

---

### 🚀 Getting Started

#### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or later)
-   [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
-   A running [PostgreSQL](https://www.postgresql.org/) database instance.
-   [Docker](https://www.docker.com/) (for containerized deployment)

#### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [your-backend-repo-url]
    cd backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the project root and populate it with your configuration. Use the `.env.example` as a template:

    ```env
    # .env.example
    DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
    JWT_SECRET="YOUR_SUPER_SECRET_KEY_THAT_IS_LONG_AND_RANDOM"
    PORT=5000
    ```

4.  **Apply database migrations:**
    This command will create all the necessary tables in your database based on the Prisma schema.
    ```bash
    npx prisma migrate dev
    ```

5.  **(Recommended) Seed the database:**
    This script will clear the database and populate it with initial sample data (admin user, workshops, etc.) for testing and development.
    ```bash
    npx prisma db seed
    ```

### ⚙️ Available Scripts

-   **Run in development mode (with hot-reloading):**
    ```bash
    npm run dev
    ```

-   **Run in production mode:**
    ```bash
    npm start
    ```

-   **Run tests:**
    ```bash
    npm test
    ```

---

### 🐳 Docker Deployment

This application includes a `Dockerfile` for easy containerization.

1.  **Build the Docker image:**
    ```bash
    docker build -t workshop-backend .
    ```

2.  **Run the Docker container:**
    Make sure you have your `.env` file ready.
    ```bash
    docker run --env-file .env -p 5000:5000 workshop-backend
    ```
    The API will be accessible at `http://localhost:5000`.

---

### 📖 API Endpoints

#### Public Routes
| Method | Endpoint             | Description                       |
| ------ | -------------------- | --------------------------------- |
| `POST` | `/api/auth/register` | Register a new customer account.  |
| `POST` | `/api/auth/login`    | Login for any user (customer/admin). |
| `GET`  | `/api/workshops`     | Get all active, public workshops. |

#### Customer Routes (Authentication Required)
| Method | Endpoint          | Description                               |
| ------ | ----------------- | ----------------------------------------- |
| `POST` | `/api/bookings`   | Book a spot in a specific workshop time slot. |

#### Admin Routes (Admin Authentication Required)
| Method   | Endpoint                   | Description                                                |
| -------- | -------------------------- | ---------------------------------------------------------- |
| `GET`    | `/api/stats`               | Get aggregated statistics for the dashboard.               |
| `POST`   | `/api/workshops`           | Create a new workshop with initial time slots.             |
| `GET`    | `/api/workshops/admin`     | Get all workshops, including archived ones.                |
| `GET`    | `/api/workshops/:id`       | Get details for a single workshop, including its time slots. |
| `DELETE` | `/api/workshops/:id`       | Soft-delete (archive) a workshop.                          |
| `PUT`    | `/api/workshops/:id/restore` | Restore an archived workshop.                              |
| `GET`    | `/api/bookings`            | Get all bookings with pagination and filtering.            |
| `PUT`    | `/api/bookings/:id`        | Update a booking's status (e.g., PENDING to CONFIRMED).      |
| `POST`   | `/api/timeslots/:workshopId` | Add a new time slot to an existing workshop.             |
| `PUT`    | `/api/timeslots/:id`       | Update an existing time slot's details.                    |
| `DELETE` | `/api/timeslots/:id`       | Delete a time slot (if it has no active bookings).         |