The 8 Production Environment Variables
STELLAR_NETWORK_MODE=mainnet
STELLAR_MAINNET_ENABLED=true
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
SOROBAN_RPC_URL=https://rpc.mainnet.stellar.gateway.fm
ESCROW_CONTRACT_ID=<your-deployed-mainnet-contract-id>
PLATFORM_ADMIN_SECRET=<your-stellar-secret-key>
UPSTASH_REDIS_REST_URL=https://<your-redis-id>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-upstash-token>
Keep all your existing Supabase, LOCAL_ENCRYPTION_KEY, CRON_SECRET, and RESEND_API_KEY values — those don't change for production.

How to get each value
1. STELLAR_NETWORK_MODE=mainnet Just change the literal string. No external service needed.

2. STELLAR_MAINNET_ENABLED=true Just change the literal string. This is a safety flag in the code.

3. NEXT_PUBLIC_STELLAR_NETWORK=mainnet Just change the literal string. Used by the wallet provider client-side.

4. SOROBAN_RPC_URL The mainnet Soroban RPC endpoint. Use one of these:

Stellar Foundation (free): https://soroban-rpc.mainnet.stellar.gateway.fm
Reliable alternative: https://rpc.mainnet.stellar.gateway.fm
You can also run your own — see Stellar documentation
5. ESCROW_CONTRACT_ID This is the contract ID you get after deploying the Soroban contract to mainnet. Run this from the project root:

cd contracts/escrow
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/escrow.wasm \
  --source <your-admin-keypair-name> \
  --network mainnet
The output will be a contract ID like CCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX. Copy that.

If you haven't set up the Stellar CLI yet:

# Install Stellar CLI
cargo install --locked stellar-cli --features opt

# Configure mainnet network
stellar network add mainnet \
  --rpc-url https://soroban-rpc.mainnet.stellar.gateway.fm \
  --network-passphrase "Public Global Stellar Network ; September 2015"

# Add your admin keypair
stellar keys add admin --secret-key
# Paste your PLATFORM_ADMIN_SECRET when prompted
6. PLATFORM_ADMIN_SECRET This is the secret key of a Stellar account that acts as the platform admin (signs admin_deposit transactions). Generate a fresh one:

# Option A — Stellar CLI
stellar keys generate platform-admin --network mainnet
stellar keys show platform-admin  # shows the secret key

# Option B — Node.js one-liner (no install needed)
node -e "
const { Keypair } = require('@stellar/stellar-sdk');
const kp = Keypair.random();
console.log('Public Key:', kp.publicKey());
console.log('Secret Key:', kp.secret());
"
Then fund the public key on mainnet with at least 5 XLM (for transaction fees and account reserve). You can buy XLM from any exchange and send to the public key.

7 & 8. UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN Upstash is a serverless Redis service with a free tier (10,000 requests/day).

Go to upstash.com → Sign up free
Click Create Database → Choose Regional → Select your region → Create
On the database page, scroll to REST API section
Copy the UPSTASH_REDIS_REST_URL (looks like https://xxxxxxxx.upstash.io)
Copy the UPSTASH_REDIS_REST_TOKEN (a long token string)
Where to set these in Vercel
Go to your Vercel project dashboard
Settings → Environment Variables
Add each variable — make sure to select Production (and optionally Preview) environment
After saving all variables, go to Deployments → click the three dots on your latest deployment → Redeploy
The redeployment picks up all new env vars. Your testnet .env.local file stays untouched for local development.