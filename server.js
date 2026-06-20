// Load environment variables from .env (only matters locally; Railway sets them via dashboard)
require("dotenv").config();

const express = require("express");
const twilio = require("twilio");

const app = express();

// Twilio sends POST bodies as URL-encoded form data, so we need this parser
app.use(express.urlencoded({ extended: false }));

// ── Twilio client (used to send SMS) ────────────────────────────────────────
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ── Environment variables ────────────────────────────────────────────────────
// Read directly from process.env inside each handler rather than destructuring
// at startup — avoids capturing undefined if a var is missing or loaded late.

const REQUIRED_ENV_VARS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_PHONE_NUMBER",
  "MY_CELL_NUMBER",
  "SHOP_NAME",
  "BOOKING_LINK",
];

const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error("Missing required environment variables:", missing.join(", "));
  process.exit(1);
}

// ── /voice — Twilio calls this when someone calls your Twilio number ─────────
//
// Flow:
//  1. Play a short hold message so the caller hears something immediately
//  2. Try to forward the call to MY_CELL_NUMBER (20-second timeout)
//  3. If the forwarded call isn't answered, Twilio hits /voice/status
//     with the dial outcome, where we send the SMS
app.post("/voice", (req, res) => {
  const MY_CELL_NUMBER = process.env.MY_CELL_NUMBER;

  // req.body.From = the original caller's phone number (E.164 format)
  // We embed it in the action URL so the status callback knows who called
  const callerNumber = req.body.From;

  // TwiML is Twilio's XML language for controlling calls
  const twiml = new twilio.twiml.VoiceResponse();

  // Say a short greeting while we try to connect — keeps the caller from
  // hearing dead silence before the forwarded phone rings
  twiml.say(
    { voice: "Polly.Joanna" },
    "Thanks for calling! Please hold for just a moment while we connect you."
  );

  // <Dial> forwards the call to MY_CELL_NUMBER.
  // - timeout: hang up the forward attempt after 20 seconds (no-answer scenario)
  // - action:  if the dial ends for any reason (busy, no-answer, timeout),
  //            Twilio will POST to this URL with the call outcome
  const dial = twiml.dial({
    timeout: 20,
    action: `/voice/status?caller=${encodeURIComponent(callerNumber)}`,
    method: "POST",
  });

  // The actual number to ring
  dial.number(MY_CELL_NUMBER);

  res.type("text/xml").send(twiml.toString());
});

// ── /voice/status — Twilio calls this after the <Dial> attempt ends ──────────
//
// req.body.DialCallStatus will be one of:
//   "completed"  → call was answered and finished normally (do nothing)
//   "no-answer"  → rang but nobody picked up  ← send SMS
//   "busy"       → line was busy              ← send SMS
//   "failed"     → could not place the call   ← send SMS
//   "canceled"   → caller hung up before dial ← do nothing
app.post("/voice/status", async (req, res) => {
  const { TWILIO_PHONE_NUMBER, SHOP_NAME, BOOKING_LINK } = process.env;
  const dialStatus = req.body.DialCallStatus;
  // Retrieve the original caller's number we embedded in the action URL
  const callerNumber = req.query.caller;

  // Only send an SMS when the call wasn't actually answered
  const missedStatuses = ["no-answer", "busy", "failed"];

  if (missedStatuses.includes(dialStatus) && callerNumber) {
    const message =
      `Hey! Sorry we missed you — this is ${SHOP_NAME}. ` +
      `What can we help with? Reply here or book a time: ${BOOKING_LINK}`;

    try {
      await twilioClient.messages.create({
        body: message,
        from: TWILIO_PHONE_NUMBER, // Must be your Twilio number
        to: callerNumber,          // The original caller
      });
      console.log(`SMS sent to ${callerNumber} (dial status: ${dialStatus})`);
    } catch (err) {
      // Log the error but don't crash — Twilio still expects a 200 response
      console.error("Failed to send SMS:", err.message);
    }
  }

  // Twilio requires a TwiML response here; an empty one is fine
  const twiml = new twilio.twiml.VoiceResponse();
  res.type("text/xml").send(twiml.toString());
});

// ── Health check — Railway (and you) can ping this to confirm it's running ───
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Start the server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Missed-call textback server running on port ${PORT}`);
});
