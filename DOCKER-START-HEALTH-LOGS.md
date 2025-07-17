# Docker Compose: Start, Health Check, and Logging Guide

This guide explains how to start all services using Docker Compose, check their health status, and view logs for all services in your DevConnect project.

---

## 1. Starting All Services

To start all backend and frontend services defined in your `docker-compose.yml`, run the following command from the `DevConnect-Backend` directory:

```bash
docker-compose up --build
```

- `--build` ensures all images are rebuilt if there are changes.
- By default, this will start all services in the foreground and display their logs in your terminal.

To run in the background (detached mode):

```bash
docker-compose up -d --build
```

---

## 2. Checking Service Health

Each service has a health check defined in `docker-compose.yml`. To see the health status of all containers, use:

```bash
docker ps
```

Look for the `STATUS` column. Healthy containers will show `healthy` (e.g., `Up 10 seconds (healthy)`).

To see detailed health status for a specific service (e.g., `auth-service`):

```bash
docker inspect --format='{{json .State.Health}}' auth-service
```

---

## 3. Viewing Logs for All Services

To view logs for all services at once (in real time):

```bash
docker-compose logs -f
```

- `-f` (or `--follow`) streams logs as they are written.
- You can also view logs for a specific service:

```bash
docker-compose logs -f <service-name>
```

For example:

```bash
docker-compose logs -f auth-service
```

---

## 4. Stopping All Services

To stop all running containers:

```bash
docker-compose down
```

---

## 5. Troubleshooting

- If a service is not healthy, check its logs for errors:
  ```bash
  docker-compose logs <service-name>
  ```
- Make sure your `.env` files are present for each service as required.
- For persistent issues, try rebuilding images:
  ```bash
  docker-compose up --build
  ```

---

**Tip:**
- You can combine commands for quick checks, e.g., `docker-compose ps` to see status, or `docker-compose logs --tail=100 -f` to see the last 100 log lines and follow new logs.

---

For more details, see the official [Docker Compose documentation](https://docs.docker.com/compose/).
