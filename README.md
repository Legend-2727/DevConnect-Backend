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