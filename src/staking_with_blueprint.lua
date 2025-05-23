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
    multiply = function(a, b)
    return tostring(bint(a) * bint(b))
  end,
  divide = function(a, b)
    return tostring(bint(a) / bint(b))
  end,
  percentage = function(a, total)
    return tostring((bint(a) / bint(total)) * bint(100))
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
STATUS = {
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

-- Below code is the one from blueprint. Are we adding this with the token process itself. and if we are using a seperate process then How to acccess Balance.

-- -- Stake Action Handler
-- Handlers.stake = function(msg)
--   local quantity = bint(msg.Tags.Quantity)
--   local height = tonumber(msg['Block-Height'])
--   assert(Balances[msg.From] and bint(Balances[msg.From]) >= quantity, "Insufficient balance to stake")
--   Balances[msg.From] = utils.subtract(Balances[msg.From], msg.Tags.Quantity) 
--   Stakers[msg.From] = Stakers[msg.From] or { amount = "0" }
--   Stakers[msg.From].amount = utils.add(Stakers[msg.From].amount, msg.Tags.Quantity)  
--   Stakers[msg.From].unstake_at = height + UnstakeDelay
--   print("Successfully Staked " .. msg.Tags.Quantity)
--   if msg.reply then
--     msg.reply({ Data = "Successfully Staked " .. msg.Tags.Quantity})
--   else
--     Send({Target = msg.From, Data = "Successfully Staked " .. msg.Tags.Quantity })
--   end
-- end

-- Handler for staking tokens
Handlers.add('stake',isValidStake, function(msg)
  assert(TokenProcess ~= "", "Token process not set")
  assert(type(msg.Tags.Quantity) == 'string', "Stake quantity required")
  if not utils.isGreaterThanOrEqual(msg.Tags.Quantity, MinimumStake) then
    Send({
      Target = TokenProcess,
      Action = "Transfer",
      Quantity = msg.Tags.Quantity,
      Recipient = msg.Sender,
      ['X-Error'] = "Stake amount below minimum"
    })
    return
  end
  initStake(msg.Sender)
  local amount = utils.add(Stakes[msg.Sender].amount or "0", msg.Tags.Quantity)
  
  -- Update stake information
  Stakes[msg.Sender] = {
    amount = amount,
    stakeTime = msg.Timestamp,
    cooldownStart = 0,
    status = STATUS.STAKED
  }
  
  Send({
      Target = msg.Sender,
      Action = "Stake-Success",
      Data = json.encode(Stakes[msg.Sender])
    })
end)

--- TODO
-- Handler for initiating unstake (starts cooldown)
Handlers.add('unstake', Handlers.utils.hasMatchingTag("Action", "Unstake"), function(msg)
  assert(Stakes[msg.From], "No active stake found")
  assert(utils.isGreaterThanOrEqual(Stakes[msg.From].amount,msg.Quantity),"Insufficient staked amount")

  local staked = Stakes[msg.From]
  assert(staked.status == STATUS.STAKED, "Stake is already in cooldown")
  -- should use Unstake map rather than Stakers map
  -- Start cooldown period
  Stakes[msg.From].cooldownStart = msg.Timestamp
  Stakes[msg.From].status = STATUS.IN_COOLDOWN
  
    msg.reply({
        Action = "Unstake-Initiated",
        Data = json.encode({
        amount = staked.amount,
        cooldownStart = staked.cooldownStart,
        withdrawalAvailable = utils.add(staked.cooldownStart, tostring(CooldownPeriod))
        })
    })
end)

--- TODO
-- Handler for withdrawing tokens after cooldown
Handlers.add('withdraw', Handlers.utils.hasMatchingTag("Action", "Withdraw"), function(msg)
  assert(Stakes[msg.From], "No stake record found")

  local staked = Stakes[msg.From]
  assert(staked.status == STATUS.IN_COOLDOWN, "unstake first to wirhdraw")
  assert(msg.Timestamp >= utils.add(staked.cooldownStart, tostring(CooldownPeriod)), "Cooldown period not completed")
  
  local stakeAmount = staked.amount

  local function safeTransfer(target, quantity)
      local success, result = pcall(function()
          return Send({
              Target = TokenProcess,
              Action = "Transfer",
              Recipient = target,
              Quantity = quantity,
              ["X-Withdraw"] = "true"
          }).receive().Tags
      end)
      
      if not success then
          -- Log error, notify user
          return {
              success = false,
              error = result
          }
      end
      
      return {
          success = true,
          result = result
      }
  end
  
  local sendStake = safeTransfer(msg.From, stakeAmount)

  if sendStake.success and sendStake.result.Action == "Debit-Notice" then
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
        timestamp = msg.Timestamp
      })
    })
    return
  end

  msg.reply({
    Action = "Withdraw-Failure",
    Data = "Some issue occured while tranferring of token"
  })

end)