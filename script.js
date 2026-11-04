// ============================================
// BB RENTALS - LOCAL STORAGE LOGIN SYSTEM
// ============================================


// ADMIN ACCOUNT
// This account is already available.

const ADMIN_EMAIL = "admin@bbrentals.com";
const ADMIN_PASSWORD = "admin123";


// ============================================
// CREATE ACCOUNT
// ============================================

function createAccount(event) {

    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("new-email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("new-password").value;
    const confirmPassword =
        document.getElementById("confirm-password").value;


    // Check all fields

    if (
        username === "" ||
        email === "" ||
        phone === "" ||
        password === "" ||
        confirmPassword === ""
    ) {

        alert("Please fill in all fields.");

        return;
    }


    // Check password

    if (password !== confirmPassword) {

        alert("Password and Confirm Password do not match.");

        return;
    }


    // Get existing users

    let users =
        JSON.parse(localStorage.getItem("bbRentalsUsers")) || [];


    // Check whether email already exists

    const existingUser = users.find(
        user => user.email.toLowerCase() === email.toLowerCase()
    );


    if (existingUser) {

        alert("An account with this email already exists.");

        return;
    }


    // Do not allow creating an account using admin email

    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {

        alert("This email is reserved for the Admin account.");

        return;
    }


    // Create new user

    const newUser = {

        username: username,

        email: email,

        phone: phone,

        password: password

    };


    // Add user to array

    users.push(newUser);


    // Save users in browser localStorage

    localStorage.setItem(
        "bbRentalsUsers",
        JSON.stringify(users)
    );


    alert("Account created successfully!");


    // Go back to login page

    window.location.href = "login.html";

}



// ============================================
// LOGIN
// ============================================

function loginUser(event) {

    event.preventDefault();


    const email =
        document.getElementById("login-email").value.trim();

    const password =
        document.getElementById("login-password").value;


    if (email === "" || password === "") {

        alert("Please enter your email and password.");

        return;
    }


    if (
        email.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
        password === ADMIN_PASSWORD
    ) {
        alert("Please use the Admin Login page to sign in as an administrator.");
        return;
    }



    // ========================================
    // CHECK NORMAL USERS
    // ========================================

    const users =
        JSON.parse(localStorage.getItem("bbRentalsUsers")) || [];


    const user = users.find(

        user =>
            user.email.toLowerCase() === email.toLowerCase() &&
            user.password === password

    );


    if (!user) {

        alert("Invalid email or password.");

        return;
    }


    // Store logged-in user

    localStorage.setItem(

        "bbRentalsLoggedInUser",

        JSON.stringify({

            username: user.username,

            email: user.email,

            phone: user.phone,

            role: "user"

        })

    );


    alert("Login successful!");


    // Resume a rental after signing in, or return to the home page.
    const pendingBooking = localStorage.getItem("bbRentalsPendingBooking");
    if (pendingBooking) {
        let bookingDetails;
        try {
            bookingDetails = JSON.parse(pendingBooking);
        } catch (error) {
            localStorage.removeItem("bbRentalsPendingBooking");
        }

        if (bookingDetails && bookingDetails.carId) {
            window.location.href =
                "details.html#" + encodeURIComponent(bookingDetails.carId);
            return;
        }
    }

    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    if (returnTo === "payments") {
        window.location.href = "payments.html";
        return;
    }

    window.location.href = "index.html";

}


function loginAdmin(event) {
    event.preventDefault();

    const email = document.getElementById("admin-login-email").value.trim();
    const password = document.getElementById("admin-login-password").value;

    if (email === "" || password === "") {
        alert("Please enter your administrator email and password.");
        return;
    }

    if (
        email.toLowerCase() !== ADMIN_EMAIL.toLowerCase() ||
        password !== ADMIN_PASSWORD
    ) {
        alert("Invalid administrator email or password.");
        return;
    }

    localStorage.removeItem("bbRentalsPendingBooking");
    localStorage.setItem("bbRentalsLoggedInUser", JSON.stringify({
        username: "Administrator",
        email: ADMIN_EMAIL,
        role: "admin"
    }));

    window.location.href = "admin.html";
}


function logoutCustomer() {
    localStorage.removeItem("bbRentalsLoggedInUser");
    window.location.href = "login.html";
}


function initCustomerPayments() {
    const rows = document.getElementById("customer-payment-rows");
    if (!rows) {
        return;
    }

    const emptyState = document.getElementById("customer-payments-empty");
    const errorState = document.getElementById("customer-payments-error");
    let user;

    try {
        user = JSON.parse(localStorage.getItem("bbRentalsLoggedInUser") || "null");
    } catch (error) {
        errorState.textContent = "Your saved login could not be read. Please sign in again.";
        errorState.hidden = false;
        return;
    }

    if (!user || user.role !== "user" || !user.email) {
        if (user && user.role === "admin") {
            window.location.href = "admin.html";
            return;
        }
        window.location.href = "login.html?returnTo=payments";
        return;
    }

    document.getElementById("payments-customer-name").textContent =
        "Signed in as " + (user.username || user.email);

    let bookings;
    try {
        bookings = JSON.parse(localStorage.getItem("bbRentalsBookings") || "[]");
    } catch (error) {
        errorState.textContent = "Saved payment history could not be read.";
        errorState.hidden = false;
        return;
    }

    if (!Array.isArray(bookings)) {
        errorState.textContent = "Saved payment history is not in a valid format.";
        errorState.hidden = false;
        return;
    }

    const customerBookings = bookings.filter(booking =>
        booking &&
        typeof booking === "object" &&
        typeof booking.customerEmail === "string" &&
        booking.customerEmail.toLowerCase() === user.email.toLowerCase()
    );
    const formatCurrency = amount => new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(amount);
    const makeCell = (row, value, className) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (className) {
            cell.className = className;
        }
        row.appendChild(cell);
    };

    let paidTotal = 0;
    let pendingTotal = 0;
    customerBookings.forEach(booking => {
        const bookingStatus = String(booking.status || "").toLowerCase();
        const paymentStatus = String(booking.paymentStatus || "pending").toLowerCase();
        const totalAmount = Number(
            booking.totalAmount ?? booking.amount ?? booking.price
        );
        const paidAmount = Number(booking.paidAmount);
        const amount = Number.isFinite(totalAmount) && totalAmount >= 0
            ? totalAmount
            : 0;

        if (bookingStatus !== "cancelled" && bookingStatus !== "canceled") {
            if (paymentStatus === "paid") {
                paidTotal += Number.isFinite(paidAmount) ? paidAmount : amount;
            } else {
                pendingTotal += amount;
            }
        }

        const row = document.createElement("tr");
        makeCell(row, booking.id || "—");
        makeCell(row, booking.carName || booking.car || "Car");
        makeCell(row, (booking.startDate || booking.pickupDate || "—") +
            " – " + (booking.endDate || booking.returnDate || "—"));
        makeCell(row, booking.paymentMethod || "Not specified");
        makeCell(row, formatCurrency(amount), "amount");
        const displayedStatus =
            bookingStatus === "cancelled" || bookingStatus === "canceled"
                ? "Cancelled"
                : paymentStatus === "paid"
                    ? "Paid"
                    : "Pending";
        makeCell(row, displayedStatus);
        rows.appendChild(row);
    });

    document.getElementById("customer-booking-count").textContent =
        String(customerBookings.length);
    document.getElementById("customer-paid-total").textContent =
        formatCurrency(paidTotal);
    document.getElementById("customer-pending-total").textContent =
        formatCurrency(pendingTotal);
    emptyState.hidden = customerBookings.length !== 0;
}


// ============================================
// RENTAL BOOKINGS
// ============================================

function initRentalBooking() {
    const rentButtons = document.querySelectorAll(".details-btn");
    const bookingDialog = document.getElementById("rental-booking-dialog");
    const bookingForm = document.getElementById("rental-booking-form");
    if (!rentButtons.length || !bookingDialog || !bookingForm) {
        return;
    }

    const carNameField = document.getElementById("booking-car-name");
    const dailyRateField = document.getElementById("booking-daily-rate");
    const pickupDateField = document.getElementById("booking-pickup-date");
    const returnDateField = document.getElementById("booking-return-date");
    const paymentMethodField = document.getElementById("booking-payment-method");
    const bookingTotalField = document.getElementById("booking-total");
    const bookingError = document.getElementById("booking-error");
    let selectedCar = null;

    function formatCurrency(amount) {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format(amount);
    }

    function updateBookingTotal() {
        const start = new Date(pickupDateField.value + "T00:00:00");
        const end = new Date(returnDateField.value + "T00:00:00");
        if (
            !pickupDateField.value ||
            !returnDateField.value ||
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            end < start
        ) {
            bookingTotalField.textContent = "Select valid rental dates";
            return null;
        }
        const rentalDays = Math.round((end - start) / 86400000) + 1;
        const total = rentalDays * selectedCar.dailyRate;
        bookingTotalField.textContent =
            formatCurrency(total) + " for " +
            rentalDays + (rentalDays === 1 ? " day" : " days");
        return { rentalDays, total };
    }

    function openBooking(carSection) {
        const heading = carSection.querySelector(".details-info h1");
        const price = carSection.querySelector(".details-price");
        const dailyRate = price
            ? Number(price.textContent.replace(/[^\d]/g, ""))
            : 0;
        if (!heading || !Number.isFinite(dailyRate) || dailyRate <= 0) {
            alert("Rental information for this car is unavailable.");
            return;
        }

        selectedCar = {
            carId: carSection.id,
            carName: heading.textContent.trim(),
            dailyRate
        };
        carNameField.textContent = selectedCar.carName;
        dailyRateField.textContent = formatCurrency(dailyRate) + " / day";

        const today = new Date();
        const todayValue = [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, "0"),
            String(today.getDate()).padStart(2, "0")
        ].join("-");
        pickupDateField.min = todayValue;
        returnDateField.min = todayValue;
        pickupDateField.value = todayValue;
        returnDateField.value = todayValue;
        bookingError.textContent = "";
        updateBookingTotal();
        bookingDialog.showModal();
    }

    rentButtons.forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();
            const carSection = button.closest(".car-details");
            if (!carSection) {
                return;
            }

            let user;
            try {
                user = JSON.parse(localStorage.getItem("bbRentalsLoggedInUser") || "null");
            } catch (error) {
                alert("Your saved login could not be read. Please sign in again.");
                return;
            }

            if (!user || user.role !== "user") {
                if (user && user.role === "admin") {
                    alert("Sign in with a customer account to book a rental.");
                    return;
                }
                const heading = carSection.querySelector(".details-info h1");
                const price = carSection.querySelector(".details-price");
                localStorage.setItem("bbRentalsPendingBooking", JSON.stringify({
                    carId: carSection.id,
                    carName: heading ? heading.textContent.trim() : "",
                    dailyRate: price
                        ? Number(price.textContent.replace(/[^\d]/g, ""))
                        : 0
                }));
                window.location.href = "login.html";
                return;
            }

            openBooking(carSection);
        });
    });

    [pickupDateField, returnDateField].forEach(field => {
        field.addEventListener("change", () => {
            returnDateField.min = pickupDateField.value || returnDateField.min;
            updateBookingTotal();
        });
    });

    bookingForm.addEventListener("submit", event => {
        event.preventDefault();
        if (!selectedCar) {
            bookingError.textContent = "Select a car before confirming your rental.";
            return;
        }

        const amounts = updateBookingTotal();
        if (!amounts || returnDateField.value < pickupDateField.value) {
            bookingError.textContent = "Choose a valid pick-up and return date.";
            return;
        }

        let user;
        let bookings;
        try {
            user = JSON.parse(localStorage.getItem("bbRentalsLoggedInUser") || "null");
            bookings = JSON.parse(localStorage.getItem("bbRentalsBookings") || "[]");
        } catch (error) {
            bookingError.textContent =
                "Saved rental data could not be read. Please check browser storage and try again.";
            return;
        }

        if (!user || user.role !== "user") {
            bookingError.textContent = "Please sign in with a customer account to continue.";
            return;
        }
        if (!Array.isArray(bookings)) {
            bookingError.textContent = "Saved bookings are not in a valid format.";
            return;
        }

        const booking = {
            id: Date.now().toString(),
            carId: selectedCar.carId,
            carName: selectedCar.carName,
            customerName: user.username || "Customer",
            customerEmail: user.email || "",
            customerPhone: user.phone || "",
            startDate: pickupDateField.value,
            endDate: returnDateField.value,
            dailyRate: selectedCar.dailyRate,
            totalAmount: amounts.total,
            paymentMethod: paymentMethodField.value,
            paymentStatus: "pending",
            paidAmount: 0,
            status: "confirmed",
            createdAt: new Date().toISOString()
        };

        try {
            bookings.push(booking);
            localStorage.setItem("bbRentalsBookings", JSON.stringify(bookings));
            localStorage.removeItem("bbRentalsPendingBooking");
        } catch (error) {
            bookingError.textContent =
                "Your rental could not be saved in browser storage. Please try again.";
            return;
        }

        bookingDialog.close();
        alert("Rental confirmed and saved. Total: " + formatCurrency(booking.totalAmount));
        window.location.href = "index.html";
    });

    const pendingBooking = localStorage.getItem("bbRentalsPendingBooking");
    if (pendingBooking) {
        try {
            const pending = JSON.parse(pendingBooking);
            const user = JSON.parse(localStorage.getItem("bbRentalsLoggedInUser") || "null");
            const carSection = document.getElementById(pending.carId);
            if (user && user.role === "user" && carSection) {
                localStorage.removeItem("bbRentalsPendingBooking");
                openBooking(carSection);
            }
        } catch (error) {
            localStorage.removeItem("bbRentalsPendingBooking");
            alert("The selected rental could not be restored. Please select the car again.");
        }
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        initRentalBooking();
        initCustomerPayments();
    });
} else {
    initRentalBooking();
    initCustomerPayments();
}