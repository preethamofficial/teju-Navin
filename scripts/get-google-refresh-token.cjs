const readline = require("readline");
const { google } = require("googleapis");
const dotenv = require("dotenv");

dotenv.config();

function assertEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question(question, resolve);
  });

  rl.close();
  return answer;
}

async function main() {
  const clientId = assertEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = assertEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  const redirectUri = assertEnv("GOOGLE_OAUTH_REDIRECT_URI");

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/photoslibrary.appendonly",
      "https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });

  console.log("Open this URL in your browser and allow access:\n");
  console.log(authUrl);
  console.log("\nAfter approval, paste the full code parameter value below.\n");

  const code = (await ask("Authorization code: ")).trim();

  if (!code) {
    throw new Error("No authorization code entered.");
  }

  const response = await oauth2Client.getToken(code);

  if (!response.tokens.refresh_token) {
    throw new Error("No refresh token returned. Retry and ensure prompt=consent.");
  }

  console.log("\nUse this in your server environment:");
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${response.tokens.refresh_token}`);
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}`);
  process.exit(1);
});
