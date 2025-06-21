# DevConnect-Backend

## Run

Make `.env` files if they don't exist (only for initial setup):

```bash
for dir in services/*/; do
    touch "$dir.env"
done
```

```bash
docker compose up --build
```

Rebuild after installing new dependencies:

```bash
docker compose down -v
docker compose up --build
```


## 🚀 Local Development with Docker

### 1. Clone Both Repositories

- **Backend:**  
  https://github.com/Legend-2727/DevConnect-Backend.git

- **Frontend:**  
  https://github.com/OitijhyaHoque/devconnect-frontend.git

> **Note:** Place both folders in the same parent directory.

---

### 2. Set Up Environment Variables

- In the `devconnect-frontend/` folder, create a `.env` file with:

    ```
    NEXT_PUBLIC_API_BASE_URL=http://auth-service:4000
    NEXT_PUBLIC_APP_BASE_URL=http://application-service:4003
    ```

- For the backend, add any required `.env` files inside their respective service folders (e.g., `services/auth-service/.env`).

---

### 3. Run the Entire Stack

- Navigate to the backend folder:

    ```bash
    cd DevConnect-Backend
    docker-compose up --build
    ```

- This will start:
    - PostgreSQL database on port **5432**
    - Auth service on port **4000**
    - Application service on port **4003**
    - Frontend (Next.js) on port **3000**

- Access your app at:  
  [http://localhost:3000](http://localhost:3000)

---

### 4. Shut Down the Stack

- To stop all containers:

    ```bash
    docker-compose down
    ```