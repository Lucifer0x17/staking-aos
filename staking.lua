local json = require('json')
local bint = require('.bint')(256)

-- Utility functions for bint operations
local utils = {
  add = function(a, b)
    return tostring(bint(a) + bint(b))
  end,
  subtract = function(a, b)
    return tostring(bint(a) - bint(b))
  end,
  toBalanceValue = function(a)
    return tostring(bint(a))
  end,
  isGreaterThanOrEqual = function(a, b)
    return bint(a) >= bint(b)
  end
}

-- Initialize State
Stakes = Stakes or {}  -- Stores all stakes: address -> {amount, stakeTime, cooldownStart, status}
TokenProcess = TokenProcess or "pHhtDqGidVc-2HQ01NMGmBbIjEYcaqOagdh9yRSljmg" -- Address of the token process
CooldownPeriod = CooldownPeriod or 30 * 24 * 60 * 60 -- 30 days in seconds
MinimumStake = MinimumStake or utils.toBalanceValue(10 * 10 ^ 12) -- 10 tokens minimum

-- Status constants
local STATUS = {
  STAKED = "STAKED",
  IN_COOLDOWN = "IN_COOLDOWN"
}

-- Initialize stake data structure
local function initStake(address)
  if not Stakes[address] then
    Stakes[address] = {
      amount = "0",
      stakeTime = 0,
      cooldownStart = 0,
      status = STATUS.STAKED
    }
  end
end

function isValidStake(Msg)
    if Msg.From == TokenProcess and Msg.Action == "Credit-Notice" and Msg["X-Action"] == "Stake" then
        return true
    else
        return false
    end
end

-- Handler for staking tokens
Handlers.add('stake',isValidStake, function(msg)
  assert(TokenProcess ~= "", "Token process not set")
  assert(type(msg.Tags.Quantity) == 'string', "Stake quantity required")
  assert(utils.isGreaterThanOrEqual(msg.Tags.Quantity, MinimumStake), "Stake amount below minimum")
  
  initStake(msg.Sender)
  local amout = utils.add(Stakes[msg.Sender].amount or "0", msg.Tags.Quantity)
  
  -- Update stake information
  Stakes[msg.Sender] = {
    amount = amout,
    stakeTime = msg.Timestamp,
    cooldownStart = 0,
    status = STATUS.STAKED
  }
  
  Send({
      Target = msg.Sender,
      Action = "Stake-Success",
      Data = json.encode(Stakes[msg.From])
    })
end)

-- Handler for initiating unstake (starts cooldown)
Handlers.add('unstake', Handlers.utils.hasMatchingTag("Action", "Unstake"), function(msg)
  assert(Stakes[msg.From], "No active stake found")

  local staked = Stakes[msg.From]
  assert(staked.status == STATUS.STAKED, "Stake is already in cooldown")
  
  -- Start cooldown period
  Stakes[msg.From].cooldownStart = msg.Timestamp
  Stakes[msg.From].status = STATUS.IN_COOLDOWN
  
    msg.reply({
        Action = "Unstake-Initiated",
        Data = json.encode({
        amount = staked.amount,
        cooldownStart = staked.cooldownStart,
        withdrawalAvailable = staked.cooldownStart + CooldownPeriod
        })
    })
end)

-- Handler for withdrawing tokens after cooldown
Handlers.add('withdraw', Handlers.utils.hasMatchingTag("Action", "Withdraw"), function(msg)
  assert(Stakes[msg.From], "No stake record found")

  local staked = Stakes[msg.From]
  assert(staked.status == STATUS.IN_COOLDOWN, "unstake first to wirhdraw")
  assert(msg.Timestamp >= staked.cooldownStart + CooldownPeriod, "Cooldown period not completed")
  
  local stakeAmount = staked.amount
  
  -- Transfer tokens back to user
  local sendStake = Send({
    Target = TokenProcess,
    Action = "Transfer",
    Recipient = msg.From,
    Quantity = stakeAmount,
    ["X-Withdraw"] = "true"
  }).receive().Tags

  if sendStake.Action == "Debit-Notice" then
    -- Reset stake data
    Stakes[msg.From] = {
      amount = "0",
      stakeTime = 0,
      cooldownStart = 0,
      status = STATUS.STAKED
    }
    
      msg.reply({
        Action = "Withdraw-Success",
        Data = json.encode({
          amount = stakeAmount,
          timestamp = ao.time
        })
      })
    return
  end

      msg.reply({
      Action = "Withdraw-Failure",
      Data = "Some issue occured while tranferring of token"
    })
  
  
end)

-- Handler to view stake information
Handlers.add('viewStake', Handlers.utils.hasMatchingTag("Action", "View-Stake"), function(msg)
  local target = msg.Tags.Target or msg.From
  initStake(target)
  
  local stakeInfo = Stakes[target]
  local timeRemaining = 0
  
  if stakeInfo.status == STATUS.IN_COOLDOWN then
    timeRemaining = math.max(0, (stakeInfo.cooldownStart + CooldownPeriod) - ao.time)
  end
  
  local response = {
    address = target,
    stake = stakeInfo,
    timeRemaining = timeRemaining,
    canWithdraw = timeRemaining == 0 and stakeInfo.status == STATUS.IN_COOLDOWN
  }
  
  if msg.reply then
    msg.reply({
      Action = "Stake-Info",
      Data = json.encode(response)
    })
  else
    Send({
      Target = msg.From,
      Action = "Stake-Info",
      Data = json.encode(response)
    })
  end
end)

-- Handler to view all stakes (admin only)
Handlers.add('viewAllStakes', Handlers.utils.hasMatchingTag("Action", "View-All-Stakes"), function(msg)
  
  if msg.reply then
    msg.reply({
      Action = "All-Stakes",
      Data = json.encode(Stakes)
    })
  else
    Send({
      Target = msg.From,
      Action = "All-Stakes",
      Data = json.encode(Stakes)
    })
  end
end)