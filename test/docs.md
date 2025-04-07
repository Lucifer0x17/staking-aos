# Test Suite Documentation

## Overview

This documentation describes the test suite for the staking and token system. The tests are written in JavaScript using Node.js and the `wao` library for interacting with the AO network. The test suite verifies the functionality of both the token and staking systems, including their interaction.

## Test Environment Setup

### Dependencies
- `wao`: ^0.15.0 (AO network interaction library)
- `node`: Required for running tests (with experimental WASM support)

### Configuration
The test suite is configured in `package.json`:
```json
{
  "scripts": {
    "test": "node --experimental-wasm-memory64 wao.test.js"
  }
}
```

## Running Tests

To run the test suite:

1. Install dependencies:
```bash
npm install
```

2. Run all tests:
```bash
npm test
```

3. Run specific test file:
```bash
node --experimental-wasm-memory64 wao.test.js
```

Note: The `--experimental-wasm-memory64` flag is required for the WASM functionality used by the wao library.

## Test Structure

The test suite is organized into several test groups using Node.js's built-in test module:

### 1. Token Operations Tests
- Tests basic token functionality
- Includes token transfers and balance checks
- Verifies token distribution to test accounts
- Tests token minting and burning

### 2. Staking Handler Tests
- Tests staking functionality
- Verifies minimum stake requirements
- Tests stake updates and multiple user staking
- Checks stake viewing capabilities
- Validates stake state transitions

### 3. Unstake Handler Tests
- Tests unstaking process
- Verifies cooldown period functionality
- Checks unstake restrictions and validations
- Tests unstake state management

### 4. Withdraw Handler Tests
- Tests token withdrawal process
- Verifies cooldown period completion
- Checks withdrawal restrictions
- Tests token return after withdrawal

### 5. Slash Proposal Tests
- Tests slash proposal creation and voting
- Verifies proposal finalization
- Checks slashing execution and stake reduction
- Tests voting weight calculations
- Validates quorum requirements

## Test Constants

The test suite uses several predefined constants:

```javascript
const CooldownPeriod = 30 * 24 * 60 * 60 // 30 days in seconds
const MinimumStake = "10000000000000" // 10 tokens
const SlashVotingPeriod = 7 * 24 * 60 * 60 // 7 days
const TokenSupply = "10000000000000000" // 10000 tokens
const TestTokenTransfer = "500000000000000" // 500 Tokens
```

## Test Accounts

The test suite uses three test accounts:
- `alice`: Primary test account (process owner)
- `bob`: Secondary test account
- `charlie`: Tertiary test account

Each account is initialized with test tokens and used for different test scenarios.

## Test Setup

Before running the tests, the suite performs the following setup:

1. Initializes the AO environment
2. Deploys the token process with initial supply
3. Deploys the staking process
4. Configures the staking process with the token process ID
5. Verifies initial token supply
6. Distributes test tokens to accounts
7. Sets up test environment variables

## Test Cases

### Token Operations
1. **Token Transfer**
   - Transfers tokens to test accounts
   - Verifies successful transfers
   - Checks transfer notifications

2. **Balance Checks**
   - Verifies token balances after transfers
   - Checks balance accuracy
   - Tests balance queries

3. **Token Management**
   - Tests token minting
   - Tests token burning
   - Verifies total supply changes

### Staking Operations
1. **Valid Stake**
   - Tests successful staking with valid amount
   - Verifies stake recording
   - Checks stake state updates

2. **Minimum Stake**
   - Tests staking with insufficient amount
   - Verifies minimum stake requirement
   - Checks error handling

3. **Stake Updates**
   - Tests additional staking
   - Verifies stake amount updates
   - Checks stake time updates

4. **Multiple User Staking**
   - Tests concurrent staking by multiple users
   - Verifies individual stake tracking
   - Checks stake isolation

### Unstake Operations
1. **Unstake Initiation**
   - Tests unstake process start
   - Verifies cooldown period initiation
   - Checks state transitions

2. **Unstake Restrictions**
   - Tests unstaking without active stake
   - Tests unstaking during cooldown
   - Verifies error conditions

3. **Cooldown Period**
   - Verifies cooldown time tracking
   - Checks withdrawal availability
   - Tests time-based restrictions

### Withdraw Operations
1. **Early Withdrawal**
   - Tests withdrawal before cooldown
   - Verifies withdrawal prevention
   - Checks error messages

2. **Valid Withdrawal**
   - Tests withdrawal after cooldown
   - Verifies token return
   - Checks state cleanup

3. **Withdrawal Restrictions**
   - Tests withdrawal without stake
   - Tests withdrawal without unstake
   - Verifies error conditions

### Slash Proposal Operations
1. **Proposal Creation**
   - Tests creating slash proposals
   - Verifies proposal parameters
   - Checks proposal state

2. **Voting**
   - Tests voting on proposals
   - Verifies vote recording
   - Tests voting restrictions
   - Checks vote weight calculations

3. **Proposal Finalization**
   - Tests proposal finalization
   - Verifies slashing execution
   - Checks stake reduction
   - Tests quorum requirements

## Test Utilities

The test suite includes several utility functions:
- `advanceTime`: Simulates time advancement for testing
- `getStakeInfo`: Retrieves stake information
- `createSlashProposal`: Creates test slash proposals
- `voteOnProposal`: Simulates voting on proposals
- `checkBalance`: Verifies token balances
- `verifyState`: Validates process state

## Error Handling

The test suite verifies error handling:
- Invalid operations
- Insufficient balances
- Invalid states
- Permission violations
- Time-based restrictions
- Quorum requirements

## Best Practices

1. **Test Isolation**
   - Each test is independent
   - Tests clean up after themselves
   - No test depends on another's state
   - Tests use unique identifiers

2. **State Verification**
   - Tests verify state changes
   - Checks both success and failure cases
   - Validates edge cases
   - Verifies state persistence

3. **Error Checking**
   - Tests verify error messages
   - Checks error conditions
   - Validates error handling
   - Tests error recovery

## Debugging Tests

To debug tests:
1. Add `console.log` statements
2. Use Node.js's built-in debugger
3. Run specific test cases
4. Check test environment setup
5. Monitor process state
6. Check network interactions

## Common Issues

1. **Network Issues**
   - Check AO network connection
   - Verify process deployment
   - Check token process configuration
   - Monitor message delivery

2. **State Issues**
   - Verify initial state
   - Check state transitions
   - Validate state persistence
   - Monitor state changes

3. **Timing Issues**
   - Check time-based operations
   - Verify cooldown periods
   - Test time advancement
   - Monitor time-sensitive operations

## Maintenance

To maintain the test suite:
1. Update tests when adding new features
2. Verify existing tests after changes
3. Add new test cases for new functionality
4. Keep test documentation up to date
5. Review test coverage
6. Update test constants as needed
7. Monitor test performance 