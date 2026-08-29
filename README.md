# Canyon Stock Watcher

A small TypeScript service that watches a Canyon product page and sends a Signal notification when a selected bike size becomes available.

The watcher is designed for a single product and size. It fetches the product page at a regular interval, parses the returned HTML with [JSDOM](https://github.com/jsdom/jsdom), and checks Canyon's size-selection markup.

## How It Works

For the configured size, the watcher looks for an element matching:

```css
.productConfiguration__optionListItem .productConfiguration__selectVariant[data-product-size="<BIKE_SIZE>"]
```

The size is considered available only when the matching element:

- exists in the fetched HTML;
- is not disabled;
- does not have `aria-disabled="true"`; and
- has Canyon's `productConfiguration__selectVariant--purchasable` class.

Canyon uses `productConfiguration__selectVariant--unpurchasable` and `productConfiguration__selectVariant--notifyMe` for an unavailable option, so those states are treated as unavailable.

The watcher sends an availability notification only when the state changes from unavailable to available. It does not repeatedly send that alert every time the polling interval runs. It also sends a running-status heartbeat every hour by default, so you can tell that the process is still alive. A network or HTTP error is logged and retried on the next poll.

This tool does not use a browser or Playwright. It only sees the HTML returned by Canyon. If Canyon moves the availability information entirely into client-side JavaScript, the checker will need a browser-based implementation.

## Project Layout

```text
.
├── checker/
│   ├── src/              TypeScript watcher and HTML checker
│   ├── tests/            Availability detection tests
│   ├── Dockerfile        Checker container image
│   ├── package.json      pnpm project configuration
│   └── pnpm-lock.yaml    Locked dependency versions
├── signal-api/
│   └── README.md         Signal bridge notes
├── compose.yaml          Local two-service Docker setup
└── .env.example          Configuration template
```

## Requirements

- Docker Desktop, for the containerized setup
- Docker Compose v2, included with current Docker Desktop versions
- A Signal account on a mobile phone, for the linked-device notification service

For local checker development, Node.js 20 or newer and pnpm are required. The repository pins pnpm in `checker/package.json`.

## Configuration

Copy the template before starting the services:

```sh
cp .env.example .env
```

Edit `.env` using this format:

```dotenv
# Full Canyon product URL, including any dwvar query parameters.
PRODUCT_URL=https://www.canyon.com/de-de/rennrad/endurance-rennrad/endurace/allroad/endurace-allroad/4477.html?dwvar_4477_pv_rahmenfarbe=R138_P01&dwvar_4477_pv_rahmengroesse=L

# Exact value from data-product-size in the Canyon HTML.
BIKE_SIZE=L

# Polling interval in seconds. Minimum: 10. Default: 300.
POLL_INTERVAL_SECONDS=300

# Running-status notification interval in seconds. Minimum: 10. Default: 3600 (one hour).
HEARTBEAT_INTERVAL_SECONDS=3600

# Optional generic JSON webhook. Leave empty to disable.
WEBHOOK_URL=

# Signal REST API. The root Docker Compose file overrides this to http://signal-api:8080
# inside the checker container. For local checker execution, use http://localhost:8080.
SIGNAL_API_URL=http://localhost:8080

# Phone number of the Signal account used by the linked device, in international format.
SIGNAL_SENDER=+49123456789

# Optional. Empty means send to SIGNAL_SENDER as a Signal Note to Self.
SIGNAL_RECIPIENT=
```

Environment values must not be quoted unless the quote characters are intended to be part of the value. Keep the full product URL on one line. The `.env` file is local configuration and should never be committed.

## Signal Linked Device Setup

The Signal service uses the prebuilt [`signal-cli-rest-api`](https://github.com/bbernhard/signal-cli-rest-api) image. It is linked to your existing Signal account; it does not register your phone number a second time.

Start only the Signal API:

```sh
docker compose up -d signal-api
docker compose ps signal-api
```

Generate a QR code and open it:

```sh
curl "http://localhost:8080/v1/qrcodelink?device_name=canyon-checker" \
  --output signal-link.png
open signal-link.png
```

On your phone, open Signal and select:

**Settings > Linked devices > Link new device**

Scan the QR code. The linked device credentials are stored in the Docker volume named `signal-data`. Do not delete that volume after linking.

Test the API with a Note to Self message:

```sh
curl -X POST "http://localhost:8080/v2/send" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Canyon checker Signal test",
    "number": "+49123456789",
    "recipients": ["+49123456789"]
  }'
```

Replace both numbers with the number configured as `SIGNAL_SENDER`.

## Run With Docker

From the repository root, build and start the complete stack:

```sh
docker compose build checker
docker compose up -d
```

Follow the watcher logs:

```sh
docker compose logs -f checker
```

Expected output looks like:

```text
Watching https://www.canyon.com/... for size L every 300s
2026-08-28T20:08:24.683Z AVAILABLE (L)
Signal notification sent
```

Stop the services without removing the linked-device volume:

```sh
docker compose down
```

The Signal API is bound to `127.0.0.1:8080`, so it is not exposed to other machines on your network. The checker reaches it over the private Docker network using `http://signal-api:8080`.

## Run Without Compose

The same containers can be started manually:

```sh
docker network create canyon-network
docker volume create canyon-checker_signal-data
docker run -d \
  --name canyon-signal-api \
  --network canyon-network \
  --env MODE=normal \
  --publish 127.0.0.1:8080:8080 \
  --volume canyon-checker_signal-data:/home/.local/share/signal-cli \
  --restart unless-stopped \
  bbernhard/signal-cli-rest-api:latest
```

Build and start the checker:

```sh
docker build --tag canyon-stock-watcher:latest ./checker
docker run -d \
  --name canyon-checker \
  --network canyon-network \
  --env-file .env \
  --env SIGNAL_API_URL=http://canyon-signal-api:8080 \
  --restart unless-stopped \
  canyon-stock-watcher:latest
```

In manual mode, `SIGNAL_API_URL` must use the Signal container name. `localhost` inside the checker container refers to the checker itself.

## Local Development

Install dependencies and run the tests from the `checker` directory:

```sh
cd checker
pnpm install
pnpm typecheck
pnpm test
pnpm watch
```

When running the checker locally, set `SIGNAL_API_URL=http://localhost:8080` in `.env`. The Signal API must already be running.

## Notifications

Signal is the recommended notification channel for this project. `WEBHOOK_URL` is also supported and receives a JSON `POST` request:

```json
{
  "text": "Canyon stock available for L: https://www.canyon.com/...",
  "url": "https://www.canyon.com/...",
  "bikeSize": "L"
}
```

Both notification channels are optional. If neither is configured, the watcher still logs availability but cannot deliver a notification.

## Responsible Use

Use a reasonable polling interval and respect Canyon's terms, availability systems, and rate limits. The default interval is five minutes and the checker enforces a minimum interval of ten seconds.
