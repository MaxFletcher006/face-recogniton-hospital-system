# Face Recognition Enabled Hospital Appointment System

A web-based hospital appointment management system that integrates facial recognition to simplify patient authentication and access to healthcare services. The system is built with **Next.js, FastAPI, PostgreSQL, and DeepFace**, enabling users to schedule doctor's appointments, book laboratory tests, and retrieve laboratory results.

## Features:

- **Facial Recognition Authentication** — Identify or verify patients using DeepFace.
- **Doctor Appointments** — Schedule and manage appointments with doctors.
- **Laboratory Appointments** — Book laboratory tests and manage laboratory orders.
- **Laboratory Results** — Retrieve and access available laboratory test results.
- **Patient Management** — Maintain patient information and associated medical service records.
- **REST API** — Connect the frontend and backend through FastAPI.
- **Relational Database** — Store and manage application data using PostgreSQL.

## Technology Stack

| Technology | Description |
|---|---|
| Next.js | Frontend web application |
| TypeScript | Frontend development and type safety |
| FastAPI | Backend REST API |
| Python | Backend logic and facial recognition processing |
| DeepFace | Facial recognition and verification |
| PostgreSQL | Relational database management |
| Mermaid | System architecture and UML diagrams |

## System Architecture

The application follows a **Model-View-Controller (MVC)-inspired architecture**, separating the user interface, application logic, and data models.

### View

The View layer provides the user interface for authentication, doctor appointments, and laboratory orders. It is implemented using Next.js.

### Controller

The Controller layer handles authentication, appointment management, and laboratory operations. FastAPI processes requests and coordinates interactions between the frontend, recognition services, and database.

### Model

The Model layer represents the core entities of the system, including users, appointments, doctors, hospitals, laboratories, and laboratory orders. PostgreSQL provides persistent data storage.

For the detailed diagrams, see:

- [System Architecture](documents/architecture.md)
- [Class Diagram](documents/class_diagram.md)
- [Sequence Diagram](documents/seq_diagram.md)

## 🔄 System Workflow

1. **User Authentication:** The user submits a facial image for recognition or verification through the authentication workflow.
2. **Identity Verification:** The backend processes the image using DeepFace and applies the configured identity-matching logic.
3. **Appointment Booking:** The authenticated user selects a doctor and schedules an appointment.
4. **Laboratory Services:** Laboratory appointments and test orders are managed through the laboratory module.
5. **Test Processing:** Laboratory staff or the relevant laboratory workflow processes requested tests and records the results.
6. **Result Retrieval:** The user accesses available laboratory results associated with their authorized account.

## Facial Recognition

The system uses **DeepFace**, a Python facial analysis framework, to support facial recognition.

The typical recognition process includes:

- Receiving a facial image from the frontend.
- Processing the image on the backend.
- Extracting facial representations using a configured recognition model.
- Comparing the representation against enrolled patient face data.
- Evaluating the match according to the configured threshold.
- Returning the authentication or verification outcome.

The specific recognition model, distance metric, threshold, and enrollment procedure depend on the implementation.

## Healthcare Management Modules

### Doctor Appointment Management

Enables users to schedule doctor's visits and manage appointment information. Appointments are associated with patients and doctors.

### Laboratory Management

Supports laboratory appointment scheduling and laboratory order management. Laboratory orders represent the tests requested for patients and their processing status.

### Laboratory Result Retrieval

Allows authorized users to retrieve available laboratory results associated with their medical records.

### Patient Authentication

Uses facial recognition to support patient identification and authentication. The system design also includes a DAN verification component, which should be documented according to its actual implementation.

## Database and Domain Model

The domain model includes the following entities:

- **User:** Patient information, contact details, insurance status, and facial template.
- **Appointment:** Appointment time, status, patient, and associated doctor.
- **Doctor:** Doctor information and availability schedule.
- **Hospital:** Hospital information and associated healthcare services.
- **Laboratory:** Laboratory information and test-processing responsibilities.
- **LabOrder:** Requested laboratory tests and associated result documents.
- **DAN:** Identity verification component defined in the system design.

PostgreSQL is used to persist application data and maintain relationships between the entities.

## Installation and Setup

### Prerequisites

- Node.js and npm
- Python and pip
- PostgreSQL
- Git

### 1. Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd <YOUR_PROJECT_DIRECTORY>
```

### 2. Configure the Database

Create a PostgreSQL database for the application:

```sql
CREATE DATABASE hospital_appointment;
```

Configure the database connection in the backend environment variables.

Example:

```env
DATABASE_URL=postgresql://<DB_USER>:<DB_PASSWORD>@localhost:5432/hospital_appointment
```

Replace the placeholders with your actual database credentials.

### 3. Start the Backend

Install the backend dependencies using the project's dependency file:

```bash
pip install -r requirements.txt
```

Configure the required environment variables and start the FastAPI server using your application's entry point. For example:

```bash
uvicorn main:app --reload
```

The API is available at `http://127.0.0.1:8000`, and interactive API documentation is available at `http://127.0.0.1:8000/docs`.

### 4. Start the Frontend

Install the frontend dependencies:

```bash
npm install
```

Configure the backend API URL in `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Start the Next.js development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

*Note: The commands and environment variable names above are examples. Adjust them to match your actual project configuration.*

## Security and Privacy

Because the system processes biometric information and medical records, appropriate security controls are essential.

- Protect patient information and laboratory results against unauthorized access.
- Enforce server-side authentication and authorization.
- Store secrets and database credentials in environment variables.
- Do not commit sensitive configuration files to version control.
- Protect facial images and facial templates against unauthorized access.
- Validate uploaded images and enforce appropriate file-size limits.
- Use HTTPS in production.
- Obtain appropriate consent for biometric data processing.
- Establish suitable data retention and deletion policies.
- Maintain audit logs for sensitive medical record access where appropriate.

Facial recognition should support identity verification rather than serve as the sole security control for accessing medical records.

## Future Improvements

Potential improvements include:

- Role-based access control for patients, doctors, laboratory staff, and administrators.
- Doctor availability management and appointment conflict prevention.
- Appointment cancellation and rescheduling.
- Laboratory result notifications.
- Improved authentication and fallback verification mechanisms.
- Automated testing and API integration testing.
- Docker-based deployment and production configuration.
- Audit logging and enhanced medical data protection.
