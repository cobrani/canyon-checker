import "dotenv/config"
import { checkStock } from "./checker.js"

const url = process.env.PRODUCT_URL
const bikeSize = process.env.BIKE_SIZE
const intervalSeconds = Number(process.env.POLL_INTERVAL_SECONDS ?? 300)
const webhookUrl = process.env.WEBHOOK_URL
const signalApiUrl = process.env.SIGNAL_API_URL
const signalSender = process.env.SIGNAL_SENDER
const signalRecipient = process.env.SIGNAL_RECIPIENT?.trim() || signalSender

if (!url || !bikeSize) {
  console.error("Set PRODUCT_URL and BIKE_SIZE before starting the watcher.")
  process.exit(1)
}

const productUrl = url
const size = bikeSize

if (!Number.isFinite(intervalSeconds) || intervalSeconds < 10) {
  console.error("POLL_INTERVAL_SECONDS must be at least 10.")
  process.exit(1)
}

if (signalApiUrl && !signalSender) {
  console.error("SIGNAL_SENDER is required when SIGNAL_API_URL is set.")
  process.exit(1)
}

const selector = `.productConfiguration__optionListItem .productConfiguration__selectVariant[data-product-size="${size.replace(/["\\]/g, "\\$&")}"]`
let previousState: boolean | undefined

async function sendSignalNotification(message: string): Promise<void> {
  if (signalApiUrl && signalSender && signalRecipient) {
    const response = await fetch(`${signalApiUrl.replace(/\/$/, "")}/v2/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message,
        number: signalSender,
        recipients: [signalRecipient],
      }),
    })
    if (!response.ok)
      throw new Error(`Signal API returned HTTP ${response.status}`)
    console.log("Signal notification sent")
  }
}

async function notify(): Promise<void> {
  const message = `Canyon stock available for ${size}: ${productUrl}`

  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: message, url: productUrl, bikeSize: size }),
    })
    if (!response.ok)
      throw new Error(`Webhook returned HTTP ${response.status}`)
    console.log("Webhook notification sent")
  }

  if (signalApiUrl && signalSender && signalRecipient) {
    await sendSignalNotification(message)
  }
}

async function poll(): Promise<void> {
  try {
    const available = await checkStock(productUrl, selector)
    console.log(
      `${new Date().toISOString()} ${available ? "AVAILABLE" : "not available"} (${size})`,
    )
    if (available && previousState !== true) await notify()
    previousState = available
  } catch (error) {
    console.error(
      "Stock check failed:",
      error instanceof Error ? error.message : error,
    )
  }
}

console.log(`Watching ${productUrl} for size ${size} every ${intervalSeconds}s`)
await poll()
await sendSignalNotification(
  `Canyon stock watcher started for ${size}: ${productUrl}.` +
    `Current state: ${previousState ? "AVAILABLE" : "not available"}`,
)

setInterval(() => void poll(), intervalSeconds * 1_000)
