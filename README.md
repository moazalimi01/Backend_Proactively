# 📅 **Session Booking Platform**

## 🚀 **Project Introduction**

Welcome to the **Session Booking Platform**, a robust and scalable backend system built with **Express.js** and **PostgreSQL**. This platform allows users to seamlessly book sessions with speakers, check speaker availability, and manage speaker profiles. The system includes functionalities such as booking time slots, sending confirmation emails, and integrating calendar events.

Designed with a clean architecture and best practices, the platform ensures a smooth and reliable experience for both **speakers** and **users** while maintaining high scalability and performance.

---

## 📘 **Technologies Used**

- **Express.js** for backend
- **PostgreSQL** as the database
- **express-validator** for input validation
- **JWT** for token generation
- **Email OTP** verification for email confirmation
- Utility modules for password hashing and comparison

## 📌 **API Endpoints**

### fill all the required things in .env file except refresh_token which is shown in next line.
### run the script : get-google-refresh-token.js to get refresh token and place it .env file 

### 1. **User Signup**

**URL:** `/api/auth/signup`  
**Method:** `POST`  

**Input Sample:**
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "securePassword123",
  "userType": "user"
}


#### Purpose  
Registers a new user with validation checks and email OTP verification.

### Request Body  
| Parameter | Type   | Description                          |
|-------------|---------|--------------------------------------|
| `firstName`  | string  | First name of the user (required)   |
| `lastName`   | string  | Last name of the user (required)    |
| `email`     | string  | Email address of the user (required, valid email)  |
| `password`  | string  | User password (minimum **6 characters**) |
| `userType`   | string  | Type of user, must be `'user'` or `'speaker'`  |

### Database Operations  
- Checks if an email already exists in the `users` table.
- Inserts user information into the database.
- Generates a 6-digit OTP and stores it in the `otp_verifications` table.
- Sends a **verification email** containing the OTP.

### Responses  
| HTTP Status | Description                                      |
|--------------|------------------------------------------------------|
| **201**       | User created successfully, prompted to verify email.  |
| **400**       | Email already registered or input validation errors.  |
| **500**       | General server error.                              |

---

### 2. **User Login**

**URL:** `/api/auth/login`  
**Method:** `POST`  

**Input Sample:**
{
  "email": "john.doe@example.com",
  "password": "securePassword123"
}

#### Used with Token
Inside the postman autherization > Bearer Token > <Token>

#### Purpose  
Authenticates a user and returns a JWT token if the login is successful.

### Request Body  
| Parameter | Type   | Description                          |
|-------------|---------|--------------------------------------|
| `email`     | string  | User email address (required)        |
| `password`  | string  | User password (required)           |

### Database Operations  
- Searches for the user in the `users` table.
- Verifies the provided password using the `comparePassword` utility function.
- Checks if the user's email is **verified**.
- Generates and returns a JWT token if authentication is successful.

### Responses  
| HTTP Status | Description                                      |
|--------------|------------------------------------------------------|
| **200**       | Authentication successful, token provided.        |
| **401**       | Invalid credentials.                               |
| **403**       | Email not verified.                                  |
| **500**       | Internal server error.                             |

---

### 3. **OTP Verification**

**URL:** `/api/auth/verify-otp`  
**Method:** `POST`  

**Input Sample:**
{
  "email": "john.doe@example.com",
  "otp": "123456"
}


#### Purpose  
Verifies the email address using the provided OTP.

### Request Body  
| Parameter | Type   | Description                          |
|-------------|---------|--------------------------------------|
| `email`     | string  | User email address (required)        |
| `otp`       | string  | OTP received via email (required)  |

### Database Operations  
- Searches for an OTP entry by joining the `otp_verifications` and `users` tables.
- If a valid OTP is found:
  - Starts a **transaction** to ensure database integrity.
  - Updates the `is_verified` field in the `users` table.
  - Deletes the OTP entry from the `otp_verifications` table.

### Responses  
| HTTP Status | Description                                      |
|--------------|------------------------------------------------------|
| **200**       | OTP verification successful, email verified.       |
| **400**       | Invalid or expired OTP.                            |
| **500**       | Internal server error.                             |

---

## ⚠️ **Error Handling**

- **Database Transactions**:  
  All signup and OTP verification operations are wrapped in **transactions** (`BEGIN`/`ROLLBACK`) to ensure atomic updates in the database.

- **Email Verification**:  
  OTPs expire in **1 hour** to prevent security breaches.

- **Response Codes**  
  Proper HTTP status codes are returned for different error cases to maintain proper client-server communication.

---


### 4. **Get Available Time Slots**

**URL:** `/api/bookings/available-slots/{speakerId}/{date}`  
**Method:** `GET`  

#### Used with Token
Inside the postman autherization > Bearer Token > <Token>

#### Purpose  
Retrieves available time slots for a specific speaker on a given date.

---

### **Parameters**  

| Parameter | Type   | Description                          |
|-------------|---------|--------------------------------------|
| `speakerId`  | integer | ID of the speaker (required)        |
| `date`      | string  | Date in **YYYY-MM-DD** format      |

---

### **Responses**  

| HTTP Status | Description                                      |
|--------------|------------------------------------------------------|
| **200**       | List of available time slots for booking.         |
| **500**       | Internal server error.                             |

---

### 5. **Book a Session**

**URL:** `/api/bookings/book`  
**Method:** `POST`  


**Input Sample:**
{
  "speakerId": 1,
  "date": "2024-12-15",
  "timeSlot": "10:00"
}

#### Used with Token
Inside the postman autherization > Bearer Token > <Token>


#### Purpose  
Allows authenticated users to book a session with a speaker at a specific date and time slot.

---

### **Request Body**

| Parameter  | Type   | Description                             |
|-------------|---------|-----------------------------------------|
| `speakerId`  | integer | ID of the speaker                      |
| `date`      | string  | Date in **YYYY-MM-DD** format         |
| `timeSlot`   | string  | Time slot in **HH:MM** format         |

---

### **Request Validation**  

- Time slots should follow the format **HH:00**.
- Time slots should only be between **9:00 AM and 4:00 PM**.

---

### **Responses**  

| HTTP Status | Description                                      |
|--------------|------------------------------------------------------|
| **200**       | Session booked successfully.                     |
| **400**       | Invalid input or time slot already booked.         |
| **401**       | Unauthorized user request.                       |
| **500**       | Internal server error.                             |

---

### **Database Operations**

- Checks if a booking already exists for the requested speaker, date, and time slot.
- If the slot is available, inserts booking details into the `session_bookings` table.
- Notifies users and speakers through email confirmations and calendar invites.

---


### 6. **Get All Speakers**

**URL:** `/api/speakers`  
**Method:** `GET`  

#### Used with Token
Inside the postman autherization > Bearer Token > <Token>

#### Purpose  
Retrieves a list of all speakers, including their basic information and expertise.

---

### **Responses**

| HTTP Status | Description                                      |
|--------------|------------------------------------------------------|
| **200**       | Returns a list of all speakers with their information. |
| **500**       | Internal server error.                             |

---

### **Database Query**  
- Fetches the following details from the database:
  - `User ID`
  - `First Name`
  - `Last Name`
  - `Expertise`
  - `Price per Session`

---

### 7. **Create/Update Speaker Profile**

**URL:** `/api/speakers/profile`  
**Method:** `POST`  

#### Used with Token
Inside the postman autherization > Bearer Token > <Token>

**Input Sample:**
{
  "expertise": "Software Development",
  "pricePerSession": 50
}


#### Purpose  
Allows a speaker to create or update their profile, including expertise and session pricing.

---

### **Authentication Required**  
- This route is **protected** and accessible only to users with the role **speaker**.
- Users must provide a valid **JWT token**.

---

### **Request Body**

| Parameter     | Type   | Description                        |
|----------------|---------|------------------------------------|
| `expertise`    | string  | Speaker's area of expertise      |
| `pricePerSession` | number | Price charged per session         |

---

### **Validation**

- The `expertise` field must not be empty.
- `pricePerSession` must be a positive number.

---

### **Responses**

| HTTP Status | Description                                      |
|--------------|------------------------------------------------------|
| **200**       | Profile updated successfully.                     |
| **401**       | Unauthorized access.                              |
| **500**       | Internal server error.                             |

---

### **Database Transactions**

- **Transaction Handling:**  
  - Updates speaker profiles using **atomic transactions** to ensure data consistency.
  - Uses the `ON CONFLICT` clause to insert new profiles or update existing ones.

---

### **Database Schema**

| Table         | Columns                                          |
|---------------|------------------------------------------------------|
| `speaker_profiles` | `user_id` (FK), `expertise`, `price_per_session` |

---

