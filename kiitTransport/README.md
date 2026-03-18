# Backend Blueprint – AMA BUS Replica for College (Full Version)

# 1. Project purpose
Replica of AMA BUS, adapted for college students (public UI for students; drivers & admins authenticated).

# 2. Backend folder structure
```
backend/
├─ config/
│  ├─ index.js
│  ├─ db.js
│  ├─ redis.js
│  └─ socket.js
├─ migrations/
├─ scripts/
│  ├─ seed.sql
│  └─ migrate.sh
├─ src/
│  ├─ server.js
│  ├─ app.js
│  ├─ controllers/
│  │  ├─ public.controller.js
│  │  ├─ driver.controller.js
│  │  └─ admin.controller.js
│  ├─ services/
│  │  ├─ auth.service.js
│  │  ├─ location.service.js
│  │  └─ eta.service.js
│  ├─ queries/
│  │  ├─ user.queries.js
│  │  ├─ bus.queries.js
│  │  └─ stop.queries.js
│  ├─ middleware/
│  │  ├─ jwtAuth.js
│  │  ├─ apiKeyAuth.js
│  │  └─ validate.js
│  ├─ utils/
│  │  ├─ geo.js
│  │  ├─ logger.js
│  │  └─ crypto.js
│  ├─ routes/
│  │  ├─ public.routes.js
│  │  ├─ driver.routes.js
│  │  └─ admin.routes.js
│  ├─ sockets/
│  │  └─ realtime.js
│  └─ workers/
│     └─ eta.cache.worker.js
├─ tests/
└─ package.json
```

# 3. File Responsibilities & Exported Functions

## controllers/public.controller.js
Handles student-facing public endpoints.  
Exports:
- `getStops(req, res)`
- `getBuses(req, res)`
- `postEtaForStop(req, res)`

## controllers/driver.controller.js
Handles driver registration, login, and location posting.  
Exports:
- `driverRegister(req, res)`
- `driverLogin(req, res)`
- `postLocation(req, res)`
- `rotateApiKey(req, res)`

## controllers/admin.controller.js
Handles admin authentication & CRUD for buses/stops/drivers.  
Exports:
- `adminRegister(req, res)`
- `adminLogin(req, res)`
- `createBus(req, res)`
- `deleteBus(req, res)`
- `createStop(req, res)`
- `deleteStop(req, res)`
- `assignDriver(req, res)`

## services/auth.service.js
Manages JWT, password hashing, and api_key generation.  
Exports:
- `generateJwt(user)`
- `verifyJwt(token)`
- `hashPassword(plain)`
- `comparePassword(plain, hash)`
- `generateApiKey()`

## services/location.service.js
Processes location pings and updates DB, Redis, and sockets.  
Exports:
- `ingestLocation({driverId, busId, lat, lng, speed, timestamp, deviceMeta})`
- `getLastLocation(busId)`
- `appendHistory(location)`

## services/eta.service.js
Calculates ETA to a stop using cached + fallback algorithms.  
Exports:
- `computeEtaToStop(busId, stopId)`
- `estimateFallbackEta(distanceMeters)`

## queries/user.queries.js
Database functions for users & drivers.  
Exports:
- `createUser(obj)`
- `getUserByEmail(email)`
- `getUserById(id)`
- `createDriverProfile(userId, busId, apiKey)`
- `getDriverByApiKey(apiKey)`

## queries/bus.queries.js
Exports:
- `createBus(obj)`
- `getBusById(id)`
- `updateBusAssignment(busId, driverId)`

## queries/stop.queries.js
Exports:
- `createStop(obj)`
- `listStops()`
- `getStopById(id)`

## utils/geo.js
Utility helpers for geolocation.  
Exports:
- `haversineMeters(lat1, lon1, lat2, lon2)`
- `bearing(lat1, lon1, lat2, lon2)`
- `roundCoord(lat, lng, precision)`

# 4. Full PostgreSQL Schema

```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','driver')),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ
);

CREATE TABLE buses (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  capacity INT,
  active BOOL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE drivers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bus_id BIGINT REFERENCES buses(id),
  api_key TEXT UNIQUE NOT NULL,
  api_key_expires TIMESTAMPTZ,
  device_meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE stops (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  seq INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE bus_last_locations (
  bus_id BIGINT PRIMARY KEY REFERENCES buses(id) ON DELETE CASCADE,
  driver_id BIGINT REFERENCES drivers(id),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed_m_s DOUBLE PRECISION,
  heading_deg DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  timestamp TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE bus_locations_history (
  id BIGSERIAL PRIMARY KEY,
  bus_id BIGINT REFERENCES buses(id),
  driver_id BIGINT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed_m_s DOUBLE PRECISION,
  heading_deg DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

# 5. API Endpoints (Complete)

## Public Endpoints
### GET /api/public/stops  
Auth: none  
Response:
```json
[{ "id":1, "name":"Main Gate", "lat":12.97, "lng":77.59 }]
```

### GET /api/public/buses  
Auth: none  
Response:
```json
[{ "id":1, "code":"CAMPUS-1", "last_location":{ "lat":12.97, "lng":77.59 }}]
```

### POST /api/public/eta/stop  
Body:
```json
{ "stopId": 3, "busId": 1 }
```
Response:
```json
{ "etaSec": 120, "distanceM": 300, "source":"cache" }
```

## Driver Endpoints
### POST /api/driver/register  
### POST /api/driver/login  
### POST /api/driver/bus/location  
Auth: `x-api-key`  
Body:
```json
{ "busId": 1, "lat": 12.97, "lng": 77.59 }
```

### POST /api/driver/rotate-apikey  

## Admin Endpoints
### POST /api/admin/register  
### POST /api/admin/login  
### POST /api/admin/bus  
### DELETE /api/admin/bus/:id  
### POST /api/admin/stop  
### DELETE /api/admin/stop/:id  
### POST /api/admin/assign-driver  

# 6. Socket.IO Design

- Namespace: `/realtime`
- Rooms:
  - `bus:<busId>`
  - `stop:<stopId>`
  - `campus:all`
- Client → Server:
  - `subscribe { type, id }`
  - `unsubscribe { type, id }`
- Server → Client:
  - `location_update`
  - `eta_update`
  - `bus_status`

# 7. Redis Key Design

| Key | TTL | Purpose |
|-----|-----|---------|
| `bus:last:<busId>` | 60s | Latest bus location |
| `bus:nearby_stops:<busId>` | 20s | Distance to nearby stops |
| `eta:stop:<stopId>:bus:<busId>` | 20–30s | Cached ETA |
| `apikey:<apiKey>` | Long | Driver device auth |
| `dir:cache:<hash>` | 15–30s | Google Directions cache |
| `lock:ingest:bus:<busId>` | 5s | Prevent race in writes |

# 8. ETA Algorithm (Full)

- Freshness threshold: **≤ 25s**
- Speeds considered moving: **≥ 1.5 m/s**
- Near-stop detection: **400–600m**
- Fallback:
  - Haversine distance
  - Assume **25 km/h** average speed
- Google Directions:
  - Only when deviation > 30%
  - Cache 15–30s

# 9. Full seed.sql

```sql
INSERT INTO users (name,email,password_hash,role) VALUES
('Admin User','admin@college.edu','$2b$10$examplehashadmin','admin');

INSERT INTO users (name,email,password_hash,role) VALUES
('Driver One','driver1@college.edu','$2b$10$examplehashdriver','driver');

INSERT INTO buses (code,description,capacity) VALUES 
('CAMPUS-1','Campus loop',30);

INSERT INTO drivers (user_id,bus_id,api_key,api_key_expires,device_meta)
VALUES (
  (SELECT id FROM users WHERE email='driver1@college.edu'),
  (SELECT id FROM buses WHERE code='CAMPUS-1'),
  'sample-api-key-abcdef123456',
  NULL,
  '{"device":"android"}'
);

INSERT INTO stops (name,lat,lng,seq) VALUES
('Main Gate', 12.9718915, 77.594566, 1),
('Library Stop', 12.9725000, 77.595000, 2),
('Hostel Block A', 12.9732000, 77.594200, 3);
```

# 10. Dev & Deploy Notes

## .env keys
```
PORT=3000
DATABASE_URL=postgres://user:pass@postgres:5432/db
REDIS_URL=redis://redis:6379
JWT_SECRET=longrandomsecret
JWT_EXPIRES=3600
GOOGLE_MAPS_KEY=your_key
```

## docker-compose (recommended)
- postgres:15  
- redis:7  
- backend (node:18+)

## npm scripts
```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "migrate": "node scripts/migrate.js",
    "seed": "psql $DATABASE_URL -f scripts/seed.sql"
  }
}
```

# 11. Roadmap (MVP)
1. Implement DB schema & migrations  
2. Implement auth (JWT + api_key)  
3. Implement location ingest with Redis + socket emit  
4. Build public endpoints + ETA service  
5. Integrate Socket.IO rooms & broadcasts  
6. Admin CRUD + deployment

