//! Stellar Guardian Escrow Contract (Soroban)
//!
//! A trustless escrow smart contract for hackathon prize distribution.
//!
//! Lifecycle:
//! 1. Platform calls `initialize` with organizer address, event_id, and target amount
//! 2. Organizer calls `deposit` to fund the escrow (can be partial or full)
//!    OR platform calls `admin_deposit` for sponsor deposits from any address
//! 3. Platform calls `lock` once fully funded (prevents further deposits)
//! 4. Platform calls `disburse_batch` one or more times to distribute prizes
//! 5. Platform calls `finalize` after all batches to mark as Released
//! 6. OR Platform calls `refund` to return all funds (on event cancellation)
//!
//! Security:
//! - Only the designated organizer can deposit via `deposit`
//! - Admin can authorize deposits from any address via `admin_deposit`
//! - Only the platform admin can lock, disburse_batch, finalize, or refund
//! - State transitions are enforced (can't disburse if not locked, etc.)
//! - All amounts use i128 (stroops precision)
//! - TTL extended on all write operations to prevent contract expiry

#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Bytes, Env, Vec, token,
};

#[contracttype]
#[derive(Clone, Copy, PartialEq)]
pub enum EscrowState {
    PendingFunding = 0,
    PartiallyFunded = 1,
    FullyFunded = 2,
    Locked = 3,
    Released = 4,
    Refunded = 5,
}

#[contracttype]
pub enum DataKey {
    Admin,           // Address - platform admin
    Organizer,       // Address - event organizer
    EventId,         // Bytes - event UUID
    Target,          // i128 - prize pool target (stroops)
    Balance,         // i128 - current balance
    State,           // EscrowState
    Token,           // Address - token contract (native XLM wrapper)
    DisbursedTotal,  // i128 - cumulative amount disbursed across batches
}

/// TTL values for contract instance storage.
const TTL_THRESHOLD: u32 = 50_000;
const TTL_EXTEND: u32 = 100_000;

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Initialize a new escrow instance.
    /// Can only be called once (fails if already initialized).
    pub fn initialize(
        env: Env,
        admin: Address,
        organizer: Address,
        event_id: Bytes,
        target: i128,
        token: Address,
    ) {
        // Ensure not already initialized
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Organizer, &organizer);
        env.storage().instance().set(&DataKey::EventId, &event_id);
        env.storage().instance().set(&DataKey::Target, &target);
        env.storage().instance().set(&DataKey::Balance, &0i128);
        env.storage().instance().set(&DataKey::State, &EscrowState::PendingFunding);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::DisbursedTotal, &0i128);

        // Extend TTL for the contract instance
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
    }

    /// Deposit funds into the escrow. Only the organizer can deposit.
    /// Automatically transitions state based on cumulative balance.
    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();

        let organizer: Address = env.storage().instance().get(&DataKey::Organizer).unwrap();
        assert!(from == organizer, "Only organizer can deposit");

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(
            state == EscrowState::PendingFunding || state == EscrowState::PartiallyFunded,
            "Cannot deposit in current state"
        );

        // Transfer tokens from organizer to this contract
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&from, &env.current_contract_address(), &amount);

        // Update balance
        let current_balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap();
        let new_balance = current_balance + amount;
        env.storage().instance().set(&DataKey::Balance, &new_balance);

        // Update state based on target
        let target: i128 = env.storage().instance().get(&DataKey::Target).unwrap();
        let new_state = if new_balance >= target {
            EscrowState::FullyFunded
        } else {
            EscrowState::PartiallyFunded
        };
        env.storage().instance().set(&DataKey::State, &new_state);

        // Refresh TTL on deposit
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("deposit"),),
            (from, amount, new_balance),
        );
    }

    /// Admin-authorized deposit from any address (sponsor use case).
    /// The admin authorizes the operation, and the sender confirms the transfer.
    pub fn admin_deposit(env: Env, from: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        from.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(
            state == EscrowState::PendingFunding || state == EscrowState::PartiallyFunded,
            "Cannot deposit in current state"
        );

        // Transfer tokens from sender to this contract
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&from, &env.current_contract_address(), &amount);

        // Update balance
        let current_balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap();
        let new_balance = current_balance + amount;
        env.storage().instance().set(&DataKey::Balance, &new_balance);

        // Update state based on target
        let target: i128 = env.storage().instance().get(&DataKey::Target).unwrap();
        let new_state = if new_balance >= target {
            EscrowState::FullyFunded
        } else {
            EscrowState::PartiallyFunded
        };
        env.storage().instance().set(&DataKey::State, &new_state);

        // Refresh TTL
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("sponsor"),),
            (from, amount, new_balance),
        );
    }

    /// Lock the escrow. Only admin can lock. Must be FullyFunded.
    pub fn lock(env: Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(state == EscrowState::FullyFunded, "Must be fully funded to lock");

        env.storage().instance().set(&DataKey::State, &EscrowState::Locked);

        // Refresh TTL on lock
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish((symbol_short!("locked"),), ());
    }

    /// Disburse a batch of prizes. Does NOT transition state to Released.
    /// Call `finalize` after all batches are processed.
    /// Only admin can disburse. Must be Locked.
    pub fn disburse_batch(env: Env, recipients: Vec<Address>, amounts: Vec<i128>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(state == EscrowState::Locked, "Must be locked to disburse");
        assert!(recipients.len() == amounts.len(), "Recipients and amounts must match");

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        let contract_addr = env.current_contract_address();

        let mut total_disbursed: i128 = 0;

        for i in 0..recipients.len() {
            let recipient = recipients.get(i).unwrap();
            let amount = amounts.get(i).unwrap();
            token_client.transfer(&contract_addr, &recipient, &amount);
            total_disbursed += amount;
        }

        // Update balance
        let current_balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap();
        env.storage().instance().set(&DataKey::Balance, &(current_balance - total_disbursed));

        // Track cumulative disbursement
        let prev_total: i128 = env.storage().instance().get(&DataKey::DisbursedTotal).unwrap_or(0);
        env.storage().instance().set(&DataKey::DisbursedTotal, &(prev_total + total_disbursed));

        // DO NOT change state — remains Locked until finalize() is called

        // Refresh TTL
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("batch"),),
            (recipients.len(), total_disbursed),
        );
    }

    /// Legacy disburse method — transitions to Released immediately.
    /// Kept for backward compat. Use disburse_batch + finalize for multi-batch.
    pub fn disburse(env: Env, recipients: Vec<Address>, amounts: Vec<i128>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(state == EscrowState::Locked, "Must be locked to disburse");
        assert!(recipients.len() == amounts.len(), "Recipients and amounts must match");

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        let contract_addr = env.current_contract_address();

        let mut total_disbursed: i128 = 0;

        for i in 0..recipients.len() {
            let recipient = recipients.get(i).unwrap();
            let amount = amounts.get(i).unwrap();
            token_client.transfer(&contract_addr, &recipient, &amount);
            total_disbursed += amount;
        }

        // Update balance and state
        let current_balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap();
        env.storage().instance().set(&DataKey::Balance, &(current_balance - total_disbursed));
        env.storage().instance().set(&DataKey::State, &EscrowState::Released);

        let prev_total: i128 = env.storage().instance().get(&DataKey::DisbursedTotal).unwrap_or(0);
        env.storage().instance().set(&DataKey::DisbursedTotal, &(prev_total + total_disbursed));

        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (symbol_short!("disburse"),),
            (recipients.len(), total_disbursed),
        );
    }

    /// Finalize disbursement — transitions state to Released.
    /// Called after all disburse_batch calls are complete.
    /// Only admin can finalize. Must be Locked.
    pub fn finalize(env: Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(state == EscrowState::Locked, "Must be locked to finalize");

        env.storage().instance().set(&DataKey::State, &EscrowState::Released);

        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish((symbol_short!("finalize"),), ());
    }

    /// Refund all funds to the organizer. Only admin can refund.
    /// Cannot refund if already Released.
    pub fn refund(env: Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(
            state != EscrowState::Released && state != EscrowState::Refunded,
            "Cannot refund in current state"
        );

        let balance: i128 = env.storage().instance().get(&DataKey::Balance).unwrap();
        if balance > 0 {
            let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
            let token_client = token::Client::new(&env, &token_addr);
            let organizer: Address = env.storage().instance().get(&DataKey::Organizer).unwrap();
            token_client.transfer(&env.current_contract_address(), &organizer, &balance);
        }

        env.storage().instance().set(&DataKey::Balance, &0i128);
        env.storage().instance().set(&DataKey::State, &EscrowState::Refunded);

        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish((symbol_short!("refund"),), balance);
    }

    // --- Read-only queries ---

    pub fn get_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Balance).unwrap_or(0)
    }

    pub fn get_state(env: Env) -> u32 {
        let state: EscrowState = env.storage().instance().get(&DataKey::State)
            .unwrap_or(EscrowState::PendingFunding);
        state as u32
    }

    pub fn get_target(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Target).unwrap_or(0)
    }

    pub fn get_disbursed_total(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::DisbursedTotal).unwrap_or(0)
    }

    pub fn is_locked(env: Env) -> bool {
        let state: EscrowState = env.storage().instance().get(&DataKey::State)
            .unwrap_or(EscrowState::PendingFunding);
        state == EscrowState::Locked
    }

    pub fn get_organizer(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Organizer).unwrap()
    }

    pub fn get_event_id(env: Env) -> Bytes {
        env.storage().instance().get(&DataKey::EventId).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::Address as _,
        token, vec, Bytes, Env,
    };

    // ── helpers ──────────────────────────────────────────────────────────────

    /// Deploy a mock SEP-41 token and return its contract address.
    fn create_token(env: &Env, admin: &Address) -> Address {
        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        token_id.address()
    }

    /// Mint `amount` stroops of the token to `recipient`.
    fn mint_token(env: &Env, token_addr: &Address, admin: &Address, recipient: &Address, amount: i128) {
        let token_admin = token::StellarAssetClient::new(env, token_addr);
        token_admin.mint(recipient, &amount);
        // Clear the auth so subsequent require_auth checks start clean.
        let _ = env.auths();
    }

    struct TestSetup {
        env: Env,
        contract_id: Address,
        admin: Address,
        organizer: Address,
        token_addr: Address,
    }

    fn setup() -> TestSetup {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let organizer = Address::generate(&env);

        let token_addr = create_token(&env, &admin);
        // Give organizer 1_000_000_000 stroops (100 XLM)
        mint_token(&env, &token_addr, &admin, &organizer, 1_000_000_000);

        let contract_id = env.register(EscrowContract, ());

        TestSetup { env, contract_id, admin, organizer, token_addr }
    }

    fn default_event_id(env: &Env) -> Bytes {
        Bytes::from_slice(env, b"test-event-uuid-001")
    }

    // ── initialize ───────────────────────────────────────────────────────────

    #[test]
    fn test_initialize_stores_all_fields() {
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        let target: i128 = 500_000_000; // 50 XLM
        client.initialize(&admin, &organizer, &default_event_id(&env), &target, &token_addr);

        assert_eq!(client.get_target(), target);
        assert_eq!(client.get_balance(), 0);
        assert_eq!(client.get_state(), EscrowState::PendingFunding as u32);
        assert!(!client.is_locked());
        assert_eq!(client.get_organizer(), organizer);
    }

    #[test]
    #[should_panic(expected = "Already initialized")]
    fn test_initialize_panics_if_called_twice() {
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        let event_id = default_event_id(&env);
        client.initialize(&admin, &organizer, &event_id, &500_000_000, &token_addr);
        // Second call must panic
        client.initialize(&admin, &organizer, &event_id, &500_000_000, &token_addr);
    }

    // ── deposit ──────────────────────────────────────────────────────────────

    #[test]
    fn test_deposit_partial_sets_partially_funded() {
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        let target: i128 = 500_000_000;
        client.initialize(&admin, &organizer, &default_event_id(&env), &target, &token_addr);

        let deposit_amount: i128 = 200_000_000; // below target
        client.deposit(&organizer, &deposit_amount);

        assert_eq!(client.get_balance(), deposit_amount);
        assert_eq!(client.get_state(), EscrowState::PartiallyFunded as u32);
    }

    #[test]
    fn test_deposit_full_sets_fully_funded() {
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        let target: i128 = 500_000_000;
        client.initialize(&admin, &organizer, &default_event_id(&env), &target, &token_addr);

        client.deposit(&organizer, &target); // exact target

        assert_eq!(client.get_balance(), target);
        assert_eq!(client.get_state(), EscrowState::FullyFunded as u32);
    }

    #[test]
    fn test_deposit_accumulates_across_multiple_calls() {
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        let target: i128 = 500_000_000;
        client.initialize(&admin, &organizer, &default_event_id(&env), &target, &token_addr);

        client.deposit(&organizer, &200_000_000);
        client.deposit(&organizer, &300_000_000); // now at target

        assert_eq!(client.get_balance(), 500_000_000);
        assert_eq!(client.get_state(), EscrowState::FullyFunded as u32);
    }

    #[test]
    #[should_panic(expected = "Only organizer can deposit")]
    fn test_deposit_rejects_non_organizer() {
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        client.initialize(&admin, &organizer, &default_event_id(&env), &500_000_000, &token_addr);

        let stranger = Address::generate(&env);
        mint_token(&env, &token_addr, &admin, &stranger, 100_000_000);
        client.deposit(&stranger, &100_000_000);
    }

    // ── admin_deposit (sponsor flow) ─────────────────────────────────────────

    #[test]
    fn test_admin_deposit_from_sponsor() {
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        client.initialize(&admin, &organizer, &default_event_id(&env), &500_000_000, &token_addr);

        let sponsor = Address::generate(&env);
        mint_token(&env, &token_addr, &admin, &sponsor, 300_000_000);

        client.admin_deposit(&sponsor, &300_000_000);

        assert_eq!(client.get_balance(), 300_000_000);
        assert_eq!(client.get_state(), EscrowState::PartiallyFunded as u32);
    }

    // ── lock ─────────────────────────────────────────────────────────────────

    #[test]
    fn test_lock_transitions_to_locked() {
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        let target: i128 = 500_000_000;
        client.initialize(&admin, &organizer, &default_event_id(&env), &target, &token_addr);
        client.deposit(&organizer, &target);
        client.lock();

        assert_eq!(client.get_state(), EscrowState::Locked as u32);
        assert!(client.is_locked());
    }

    #[test]
    #[should_panic(expected = "Must be fully funded to lock")]
    fn test_lock_panics_if_not_fully_funded() {
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        client.initialize(&admin, &organizer, &default_event_id(&env), &500_000_000, &token_addr);
        client.deposit(&organizer, &100_000_000); // only partial
        client.lock(); // must panic
    }

    // ── disburse (single-batch, transitions to Released) ─────────────────────

    #[test]
    fn test_disburse_pays_winners_and_releases() {
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        let target: i128 = 500_000_000;
        client.initialize(&admin, &organizer, &default_event_id(&env), &target, &token_addr);
        client.deposit(&organizer, &target);
        client.lock();

        let winner1 = Address::generate(&env);
        let winner2 = Address::generate(&env);
        let recipients = vec![&env, winner1.clone(), winner2.clone()];
        let amounts = vec![&env, 300_000_000i128, 200_000_000i128];

        client.disburse(&recipients, &amounts);

        assert_eq!(client.get_state(), EscrowState::Released as u32);
        assert_eq!(client.get_balance(), 0);
        assert_eq!(client.get_disbursed_total(), 500_000_000);

        // Verify token balances
        let token_client = token::Client::new(&env, &token_addr);
        assert_eq!(token_client.balance(&winner1), 300_000_000);
        assert_eq!(token_client.balance(&winner2), 200_000_000);
    }

    #[test]
    #[should_panic(expected = "Must be locked to disburse")]
    fn test_disburse_panics_if_not_locked() {
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        let target: i128 = 500_000_000;
        client.initialize(&admin, &organizer, &default_event_id(&env), &target, &token_addr);
        client.deposit(&organizer, &target);
        // skip lock()
        let winner = Address::generate(&env);
        client.disburse(&vec![&env, winner], &vec![&env, 100_000_000i128]);
    }

    // ── disburse_batch + finalize (multi-batch flow) ─────────────────────────

    #[test]
    fn test_disburse_batch_stays_locked_until_finalize() {
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        let target: i128 = 500_000_000;
        client.initialize(&admin, &organizer, &default_event_id(&env), &target, &token_addr);
        client.deposit(&organizer, &target);
        client.lock();

        let winner1 = Address::generate(&env);
        let winner2 = Address::generate(&env);

        // First batch
        client.disburse_batch(
            &vec![&env, winner1.clone()],
            &vec![&env, 300_000_000i128],
        );
        // State must still be Locked
        assert_eq!(client.get_state(), EscrowState::Locked as u32);
        assert_eq!(client.get_balance(), 200_000_000);

        // Second batch
        client.disburse_batch(
            &vec![&env, winner2.clone()],
            &vec![&env, 200_000_000i128],
        );
        assert_eq!(client.get_balance(), 0);
        assert_eq!(client.get_disbursed_total(), 500_000_000);

        // finalize transitions to Released
        client.finalize();
        assert_eq!(client.get_state(), EscrowState::Released as u32);
    }

    // ── refund ───────────────────────────────────────────────────────────────

    #[test]
    fn test_refund_returns_balance_to_organizer_and_sets_refunded() {
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        let target: i128 = 500_000_000;
        client.initialize(&admin, &organizer, &default_event_id(&env), &target, &token_addr);

        let deposit_amount: i128 = 300_000_000;
        client.deposit(&organizer, &deposit_amount);

        let token_client = token::Client::new(&env, &token_addr);
        let before_refund = token_client.balance(&organizer);

        client.refund();

        assert_eq!(client.get_state(), EscrowState::Refunded as u32);
        assert_eq!(client.get_balance(), 0);
        // Organizer got funds back
        let after_refund = token_client.balance(&organizer);
        assert_eq!(after_refund - before_refund, deposit_amount);
    }

    #[test]
    #[should_panic(expected = "Cannot refund in current state")]
    fn test_refund_panics_if_already_released() {
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        let target: i128 = 500_000_000;
        client.initialize(&admin, &organizer, &default_event_id(&env), &target, &token_addr);
        client.deposit(&organizer, &target);
        client.lock();
        let winner = Address::generate(&env);
        client.disburse(&vec![&env, winner], &vec![&env, target]);
        // Already Released — refund must panic
        client.refund();
    }

    // ── read-only queries ─────────────────────────────────────────────────────

    #[test]
    fn test_read_queries_return_correct_values() {
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        let target: i128 = 500_000_000;
        let event_id = default_event_id(&env);
        client.initialize(&admin, &organizer, &event_id, &target, &token_addr);

        assert_eq!(client.get_target(), target);
        assert_eq!(client.get_balance(), 0);
        assert_eq!(client.get_disbursed_total(), 0);
        assert_eq!(client.get_state(), EscrowState::PendingFunding as u32);
        assert!(!client.is_locked());
        assert_eq!(client.get_organizer(), organizer);
        assert_eq!(client.get_event_id(), event_id);
    }

    // ── conservation of funds property ───────────────────────────────────────

    #[test]
    fn test_conservation_of_funds() {
        // net disbursed == funded amount after full cycle
        let TestSetup { env, contract_id, admin, organizer, token_addr } = setup();
        let client = EscrowContractClient::new(&env, &contract_id);

        let target: i128 = 600_000_000;
        client.initialize(&admin, &organizer, &default_event_id(&env), &target, &token_addr);
        client.deposit(&organizer, &target);
        client.lock();

        let w1 = Address::generate(&env);
        let w2 = Address::generate(&env);
        let w3 = Address::generate(&env);
        let amounts = vec![&env, 300_000_000i128, 200_000_000i128, 100_000_000i128];
        let recipients = vec![&env, w1.clone(), w2.clone(), w3.clone()];

        client.disburse(&recipients, &amounts);

        let token_client = token::Client::new(&env, &token_addr);
        let total_received =
            token_client.balance(&w1) + token_client.balance(&w2) + token_client.balance(&w3);

        assert_eq!(total_received, target);
        assert_eq!(client.get_disbursed_total(), target);
        assert_eq!(client.get_balance(), 0);
    }
}
