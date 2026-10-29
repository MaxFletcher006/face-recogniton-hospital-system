classDiagram
    User "1" -- "0..*" Appointment : makes
    User "1" -- "1" DAN : authenticates via
    Hospital "1" *-- "1..*" Doctor : employs
    Hospital "1" *-- "1..*" Laboratory : owns
    Doctor "1" -- "0..*" Appointment : handles
    Laboratory "1" -- "0..*" LabOrder : processes

    class User {
        -firstname: String
        -lastname: String
        -RD: String
        -phoneNumber: String
        -address: String
        -insuranceStatus: Boolean
        -faceTemplate: Binary
        +loginByFace()
        +authByFace()
        +authByDAN()
    }

    class Appointment {
        -appointmentTime: DateTime
        -status: String
        +cancelAppointment()
    }

    class DAN {
        +getDANdata()
        +verifyUser()
    }

    class Hospital {
        -hospitalID: String
        -name: String
        +getQueue()
    }

    class Doctor {
        -doctorID: String
        -firstname: String
        -lastname: String
        -schedule: List
    }

    class Laboratory {
        -labID: String
        -type: String
        +processTest(LabOrder)
    }

    class LabOrder {
        -testTypes: List
        -resultPDF: File
        +sendToEmail()
        +printResult()
    }