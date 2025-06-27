# 🚀 Auction.io API Documentation

## Base URL
```
Development: http://localhost:3000/api
Production: https://api.auction.io/api
```

## Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Response Format
All API responses follow this standard format:
```json
{
  "success": true|false,
  "message": "Description of the result",
  "data": { ... },
  "error": { ... }, // Only present when success is false
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Error Codes
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resources)
- `422` - Unprocessable Entity (business logic errors)
- `500` - Internal Server Error

---

## 🔐 Authentication Endpoints

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt_token_here"
  }
}
```

### POST /auth/login
Authenticate user and get access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER"
    },
    "token": "jwt_token_here"
  }
}
```

### POST /auth/refresh
Refresh JWT token.

**Headers:**
```
Authorization: Bearer <current_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "token": "new_jwt_token_here"
  }
}
```

### POST /auth/forgot-password
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### POST /auth/reset-password
Reset password using reset token.

**Request Body:**
```json
{
  "token": "reset_token",
  "newPassword": "newpassword123"
}
```

---

## 👥 User Management Endpoints

### GET /users/profile
Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "firstName": "John",
    "lastName": "Doe",
    "profileImage": "url",
    "role": "USER",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### PUT /users/profile
Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890"
}
```

### POST /users/upload-avatar
Upload profile picture.

**Headers:** `Authorization: Bearer <token>`

**Request:** Multipart form data with 'avatar' field

---

## 🏆 Team Management Endpoints

### GET /teams
Get all teams for the current user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by team name

**Response:**
```json
{
  "success": true,
  "data": {
    "teams": [
      {
        "id": "uuid",
        "name": "Team Alpha",
        "shortName": "TPA",
        "description": "Our awesome team",
        "logoUrl": "url",
        "primaryColor": "#FF0000",
        "secondaryColor": "#0000FF",
        "ownerId": "uuid",
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "pages": 1
    }
  }
}
```

### POST /teams
Create a new team.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Team Alpha",
  "shortName": "TPA",
  "description": "Our awesome team",
  "primaryColor": "#FF0000",
  "secondaryColor": "#0000FF"
}
```

### GET /teams/:id
Get team details by ID.

**Headers:** `Authorization: Bearer <token>`

### PUT /teams/:id
Update team information.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Updated Team Name",
  "description": "Updated description"
}
```

### DELETE /teams/:id
Delete a team.

**Headers:** `Authorization: Bearer <token>`

### POST /teams/:id/upload-logo
Upload team logo.

**Headers:** `Authorization: Bearer <token>`

**Request:** Multipart form data with 'logo' field

---

## 🏃‍♂️ Player Management Endpoints

### GET /players
Get all players.

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `search` (optional): Search by name
- `position` (optional): Filter by position
- `category` (optional): Filter by category
- `minPrice` (optional): Minimum base price
- `maxPrice` (optional): Maximum base price

**Response:**
```json
{
  "success": true,
  "data": {
    "players": [
      {
        "id": "uuid",
        "name": "Player Name",
        "position": "Batsman",
        "category": "Domestic",
        "basePrice": 1000000,
        "imageUrl": "url",
        "nationality": "India",
        "age": 25,
        "experience": 5,
        "rating": 85,
        "bio": "Player biography",
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10
    }
  }
}
```

### POST /players
Create a new player.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Player Name",
  "position": "Batsman",
  "category": "Domestic",
  "basePrice": 1000000,
  "nationality": "India",
  "age": 25,
  "experience": 5,
  "rating": 85,
  "bio": "Player biography"
}
```

### GET /players/:id
Get player details by ID.

### PUT /players/:id
Update player information.

**Headers:** `Authorization: Bearer <token>`

### DELETE /players/:id
Delete a player.

**Headers:** `Authorization: Bearer <token>`

### POST /players/bulk-import
Import players from CSV.

**Headers:** `Authorization: Bearer <token>`

**Request:** Multipart form data with 'csv' field

### POST /players/:id/upload-image
Upload player image.

**Headers:** `Authorization: Bearer <token>`

---

## 🎯 Auction Management Endpoints

### GET /auctions
Get all auctions.

**Query Parameters:**
- `status` (optional): Filter by status
- `page`, `limit`: Pagination

**Response:**
```json
{
  "success": true,
  "data": {
    "auctions": [
      {
        "id": "uuid",
        "name": "IPL 2024 Auction",
        "description": "Annual IPL player auction",
        "budgetCap": 10000000,
        "maxPlayersPerTeam": 25,
        "minPlayersPerTeam": 18,
        "bidIncrement": 25000,
        "bidTimerSeconds": 30,
        "status": "SCHEDULED",
        "scheduledStart": "2024-02-01T10:00:00.000Z",
        "createdBy": "uuid",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

### POST /auctions
Create a new auction.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "IPL 2024 Auction",
  "description": "Annual IPL player auction",
  "budgetCap": 10000000,
  "maxPlayersPerTeam": 25,
  "minPlayersPerTeam": 18,
  "bidIncrement": 25000,
  "bidTimerSeconds": 30,
  "scheduledStart": "2024-02-01T10:00:00.000Z"
}
```

### GET /auctions/:id
Get auction details.

### PUT /auctions/:id
Update auction configuration.

**Headers:** `Authorization: Bearer <token>`

### DELETE /auctions/:id
Delete an auction.

**Headers:** `Authorization: Bearer <token>`

### POST /auctions/:id/teams
Add team to auction.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "teamId": "uuid"
}
```

### DELETE /auctions/:id/teams/:teamId
Remove team from auction.

**Headers:** `Authorization: Bearer <token>`

### GET /auctions/:id/teams
Get all teams in auction.

### POST /auctions/:id/players
Add player to auction.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "playerId": "uuid"
}
```

### GET /auctions/:id/players
Get all players in auction.

### POST /auctions/:id/start
Start the auction.

**Headers:** `Authorization: Bearer <token>`

### POST /auctions/:id/pause
Pause the auction.

**Headers:** `Authorization: Bearer <token>`

### POST /auctions/:id/resume
Resume the auction.

**Headers:** `Authorization: Bearer <token>`

### POST /auctions/:id/end
End the auction.

**Headers:** `Authorization: Bearer <token>`

---

## 💰 Bidding Endpoints

### GET /auctions/:id/current-player
Get currently active player for bidding.

**Response:**
```json
{
  "success": true,
  "data": {
    "player": {
      "id": "uuid",
      "name": "Player Name",
      "position": "Batsman",
      "basePrice": 1000000,
      "imageUrl": "url"
    },
    "currentBid": {
      "amount": 1500000,
      "teamId": "uuid",
      "teamName": "Team Alpha"
    },
    "timeRemaining": 25,
    "bidHistory": [
      {
        "amount": 1500000,
        "teamName": "Team Alpha",
        "timestamp": "2024-01-01T10:00:00.000Z"
      }
    ]
  }
}
```

### POST /auctions/:id/bid
Place a bid on current player.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "teamId": "uuid",
  "amount": 1750000
}
```

### GET /auctions/:id/bids
Get bid history for auction.

**Query Parameters:**
- `playerId` (optional): Filter by player
- `teamId` (optional): Filter by team

---

## 📊 Dashboard & Analytics Endpoints

### GET /auctions/:id/dashboard
Get auction dashboard data.

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalPlayers": 100,
      "soldPlayers": 75,
      "unsoldPlayers": 25,
      "totalMoneySpent": 75000000,
      "averagePrice": 1000000,
      "teamsCount": 8
    },
    "teamStats": [
      {
        "teamId": "uuid",
        "teamName": "Team Alpha",
        "playersCount": 10,
        "moneySpent": 10000000,
        "moneyLeft": 2000000,
        "spotsOpen": 15
      }
    ],
    "recentActivity": [
      {
        "type": "PLAYER_SOLD",
        "playerName": "Player Name",
        "teamName": "Team Alpha",
        "amount": 2000000,
        "timestamp": "2024-01-01T10:00:00.000Z"
      }
    ]
  }
}
```

### GET /auctions/:id/analytics
Get detailed auction analytics.

**Query Parameters:**
- `type`: `team_performance`, `price_trends`, `position_analysis`

### GET /auctions/:id/export
Export auction results.

**Query Parameters:**
- `format`: `pdf`, `excel`, `csv`

**Headers:** `Authorization: Bearer <token>`

---

## 🔄 WebSocket Events

### Connection
```javascript
const socket = io('ws://localhost:3000', {
  auth: {
    token: 'jwt_token_here'
  }
});

// Join auction room
socket.emit('join-auction', { auctionId: 'uuid' });
```

### Events Emitted by Client

#### `join-auction`
Join an auction room.
```javascript
socket.emit('join-auction', { auctionId: 'uuid' });
```

#### `place-bid`
Place a bid on current player.
```javascript
socket.emit('place-bid', {
  auctionId: 'uuid',
  teamId: 'uuid',
  amount: 1500000
});
```

#### `admin-action`
Admin control actions.
```javascript
socket.emit('admin-action', {
  auctionId: 'uuid',
  action: 'pause|resume|skip|next-player',
  data: {}
});
```

### Events Received from Server

#### `auction-joined`
Confirmation of joining auction room.
```javascript
socket.on('auction-joined', (data) => {
  console.log('Joined auction:', data.auctionId);
});
```

#### `player-update`
Current player information update.
```javascript
socket.on('player-update', (data) => {
  // Update UI with current player
  console.log('Current player:', data.player);
});
```

#### `bid-placed`
New bid placed notification.
```javascript
socket.on('bid-placed', (data) => {
  console.log('New bid:', data.amount, 'by', data.teamName);
});
```

#### `player-sold`
Player sold notification.
```javascript
socket.on('player-sold', (data) => {
  console.log('Player sold:', data.playerName, 'to', data.teamName, 'for', data.amount);
});
```

#### `auction-status`
Auction status changes.
```javascript
socket.on('auction-status', (data) => {
  console.log('Auction status:', data.status);
});
```

#### `team-stats-update`
Team statistics update.
```javascript
socket.on('team-stats-update', (data) => {
  // Update team statistics in UI
  console.log('Team stats updated:', data.teams);
});
```

#### `timer-update`
Bidding timer updates.
```javascript
socket.on('timer-update', (data) => {
  console.log('Time remaining:', data.seconds);
});
```

#### `error`
Error notifications.
```javascript
socket.on('error', (data) => {
  console.error('Socket error:', data.message);
});
```

---

## 🔒 Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Authentication endpoints**: 5 requests per minute per IP
- **General API endpoints**: 100 requests per minute per user
- **File upload endpoints**: 10 requests per minute per user
- **WebSocket connections**: 1 connection per user per auction

---

## 📝 Request/Response Examples

### Successful Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    "id": "uuid",
    "name": "Resource Name"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Pagination Response
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

## 🧪 Testing

### Postman Collection
A complete Postman collection is available for testing all endpoints.

### API Testing Examples
```bash
# Register new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Get user profile
curl -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer <jwt_token>"
```

This comprehensive API documentation provides all the necessary endpoints and specifications for building a robust auction platform with real-time bidding capabilities. 