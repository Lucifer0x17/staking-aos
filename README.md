# Staking and Token System

A comprehensive staking and token system implemented for the AO network, featuring token management and staking capabilities with slashing mechanisms.

## Project Structure

```
.
├── src/
│   ├── staking.lua    # Staking system implementation
│   ├── token.lua      # Token system implementation
│   └── docs.md        # System documentation
├── test/
│   ├── wao.test.js    # Test suite
│   └── docs.md        # Test documentation
└── README.md          # This file
```

## Components

### 1. Token System
- Implements the ao Standard Token Specification
- Supports token transfers, minting, burning, and balance queries
- Uses big integer arithmetic for precise calculations
- Maintains total supply and individual balances

### 2. Staking System
- Allows users to stake tokens
- Implements cooldown period for unstaking
- Supports slashing mechanism for misbehavior
- Includes voting system for slashing proposals

## Prerequisites

- Node.js (with experimental WASM support)
- npm
- Access to AO network

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd staking_task1
```

2. Install dependencies:
```bash
npm install
```

## Running Tests

The project includes a comprehensive test suite to verify functionality:

```bash
# Run all tests
npm test

# Run specific test file
node --experimental-wasm-memory64 test/wao.test.js
```

Note: The `--experimental-wasm-memory64` flag is required for WASM functionality.

## Key Features

### Token System
- Token transfers
- Balance queries
- Token minting (owner only)
- Token burning
- Test token distribution

### Staking System
- Token staking with minimum requirements
- Unstaking with cooldown period
- Token withdrawal after cooldown
- Slash proposal creation and voting
- Stake viewing and management

## Configuration

### Token System
- Denomination: 12 decimal places
- Initial supply: 10000 tokens
- Name: Test Coin
- Ticker: TEST

### Staking System
- Minimum stake: 10 tokens
- Cooldown period: 30 days
- Slash voting period: 7 days
- Quorum requirement: 50% of staked tokens
- Slash percentage: 20% of staked tokens
- Minimum slash votes: 3 unique voters

## Usage Examples

### Token Operations
```lua
-- Get token info
Send({ Action = "Info" })

-- Check balance
Send({ Action = "Balance" })

-- Transfer tokens
Send({
  Action = "Transfer",
  Recipient = "target-address",
  Quantity = "1000000000000"
})
```

### Staking Operations
```lua
-- Stake tokens
Send({
  Action = "Stake",
  Quantity = "10000000000000"
})

-- Unstake tokens
Send({ Action = "Unstake" })

-- Withdraw after cooldown
Send({ Action = "Withdraw" })
```

## Security Features

1. **Token Security**
   - Only process owner can mint new tokens
   - Transfers require sufficient balance
   - Big integer arithmetic prevents overflow

2. **Staking Security**
   - Minimum stake requirement
   - Cooldown period for unstaking
   - Slashing mechanism with voting requirements
   - Quorum and minimum vote requirements

## Documentation

For detailed information about the system and its testing, refer to the following documentation:

1. [System Documentation](./src/docs.md)
   - Detailed explanation of the token and staking systems
   - Component descriptions and interactions
   - Security considerations
   - Usage examples and best practices

2. [Test Documentation](./test/docs.md)
   - Test suite structure and organization
   - Test cases and scenarios
   - Running and debugging tests
   - Common issues and solutions

## Dependencies

- `json`: For JSON encoding/decoding
- `bint`: For big integer arithmetic
- `ao`: For process identification and messaging
- `wao`: For test suite implementation

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request