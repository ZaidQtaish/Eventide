package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

func (a *App) GetUsersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()

	rows, err := a.DB.Query(ctx, "SELECT id, username, name, role, COALESCE(phone_number, '') FROM users ORDER BY username")
	if err != nil {
		http.Error(w, "Query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Username, &u.Name, &u.Role, &u.PhoneNumber); err != nil {
			continue
		}
		users = append(users, u)
	}

	writeJSON(w, http.StatusOK, users)
}

func (a *App) CreateUserHandler(w http.ResponseWriter, r *http.Request) {
	userRole := a.GetSessionRole(r)
	if userRole != "admin" {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, "Only admins can create users", http.StatusForbidden)
		return
	}

	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	username := strings.TrimSpace(req.Username)
	password := strings.TrimSpace(req.Password)
	name := strings.TrimSpace(req.Name)
	role := strings.TrimSpace(req.Role)
	phone := strings.TrimSpace(req.PhoneNumber)

	if username == "" || password == "" || name == "" || role == "" || phone == "" {
		http.Error(w, "Missing required fields: username, password, name, role, phone_number", http.StatusBadRequest)
		return
	}

	if len(password) < 6 {
		http.Error(w, "Password must be at least 6 characters", http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Password hashing failed", http.StatusInternalServerError)
		return
	}

	ctx := r.Context()
	var createdUser User

	err = a.DB.QueryRow(
		ctx,
		"INSERT INTO users (username, password_hash, name, role, phone_number) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, name, role, COALESCE(phone_number, '')",
		username,
		string(hashedPassword),
		name,
		role,
		phone,
	).Scan(&createdUser.ID, &createdUser.Username, &createdUser.Name, &createdUser.Role, &createdUser.PhoneNumber)

	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			http.Error(w, "Username already exists", http.StatusConflict)
			return
		}
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, createdUser)
}

func (a *App) UsersHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/users" {
		id, err := parseUserIDFromPath(r.URL.Path)
		if err != nil {
			http.Error(w, "Invalid user id", http.StatusBadRequest)
			return
		}

		switch r.Method {
		case http.MethodPut:
			a.UpdateUserHandler(w, r, id)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	switch r.Method {
	case http.MethodGet:
		a.GetUsersHandler(w, r)
	case http.MethodPost:
		a.CreateUserHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (a *App) UpdateUserHandler(w http.ResponseWriter, r *http.Request, userID int) {
	if userID <= 0 {
		http.Error(w, "Invalid user id", http.StatusBadRequest)
		return
	}

	if a.GetSessionRole(r) != "admin" {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, "Only admins can update users", http.StatusForbidden)
		return
	}

	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	username := strings.TrimSpace(req.Username)
	name := strings.TrimSpace(req.Name)
	role := strings.TrimSpace(req.Role)
	phone := strings.TrimSpace(req.PhoneNumber)
	password := strings.TrimSpace(req.Password)

	if username == "" || name == "" || role == "" {
		http.Error(w, "Missing required fields: username, name, role, phone_number", http.StatusBadRequest)
		return
	}

	if phone == "" {
		http.Error(w, "phone_number is required", http.StatusBadRequest)
		return
	}

	if password != "" && len(password) < 6 {
		http.Error(w, "Password must be at least 6 characters", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	var updatedUser User

	if password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "Password hashing failed", http.StatusInternalServerError)
			return
		}

		err = a.DB.QueryRow(
			ctx,
			"UPDATE users SET username = $1, name = $2, role = $3, phone_number = $4, password_hash = $5 WHERE id = $6 RETURNING id, username, name, role, COALESCE(phone_number, '')",
			username,
			name,
			role,
			phone,
			string(hashedPassword),
			userID,
		).Scan(&updatedUser.ID, &updatedUser.Username, &updatedUser.Name, &updatedUser.Role, &updatedUser.PhoneNumber)
		if err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
				http.Error(w, "Username already exists", http.StatusConflict)
				return
			}
			http.Error(w, "Failed to update user", http.StatusInternalServerError)
			return
		}
	} else {
		err := a.DB.QueryRow(
			ctx,
			"UPDATE users SET username = $1, name = $2, role = $3, phone_number = $4 WHERE id = $5 RETURNING id, username, name, role, COALESCE(phone_number, '')",
			username,
			name,
			role,
			phone,
			userID,
		).Scan(&updatedUser.ID, &updatedUser.Username, &updatedUser.Name, &updatedUser.Role, &updatedUser.PhoneNumber)
		if err != nil {
			if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
				http.Error(w, "Username already exists", http.StatusConflict)
				return
			}
			http.Error(w, "Failed to update user", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, http.StatusOK, updatedUser)
}
