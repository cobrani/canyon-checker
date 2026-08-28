# Signal API

The root `compose.yaml` runs `bbernhard/signal-cli-rest-api` as a linked Signal device. The API is exposed only on `localhost:8080` and its data is persisted in the `signal-data` Docker volume.

Link it from the repository root:

```sh
docker compose up -d signal-api
curl "http://localhost:8080/v1/qrcodelink?device_name=canyon-checker" --output signal-link.png
open signal-link.png
```

Scan the QR code using Signal on the primary phone. Do not register the phone number again; link the container as an additional device.
