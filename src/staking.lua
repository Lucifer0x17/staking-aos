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
SlashProposals = SlashProposals or {}
TokenProcess = TokenProcess or "pHhtDqGidVc-2HQ01NMGmBbIjEYcaqOagdh9yRSljmg" -- Address of the token process
CooldownPeriod = CooldownPeriod or 30 * 24 * 60 * 60 -- 30 days in seconds
MinimumStake = MinimumStake or utils.toBalanceValue(10 * 10 ^ 12) -- 10 tokens minimum

-- Slash Voting Configuration
local SlashConfig = {
  VOTING_PERIOD = 7 * 24 * 60 * 60,  -- 7 days
  QUORUM_PERCENTAGE = 50,  -- 50% of total staked tokens must vote
  SLASH_PERCENTAGE = 20,   -- 20% of staked tokens can be slashed
  MINIMUM_SLASH_VOTES = 3  -- Minimum number of unique voters to initiate slash
}

-- Slash Proposal Status
local PROPOSAL_STATUS = {
  OPEN = "OPEN",
  FAILED = "FAILED",
  EXECUTED = "EXECUTED"
}

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
        withdrawalAvailable = utils.add(staked.cooldownStart, tostring(CooldownPeriod))
        })
    })
end)

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

-- Handler to Create a Slash Proposal
Handlers.add('createSlashProposal', Handlers.utils.hasMatchingTag("Action", "Create-Slash-Proposal"), function(msg)
  assert(msg.Tags.Target, "Target address for slashing is required")
  assert(Stakes[msg.Tags.Target], "Target must have an active stake")
  
  local proposalId = msg.Id  -- Use message ID as proposal ID
  
  SlashProposals[proposalId] = {
    targetAddress = msg.Tags.Target,
    proposer = msg.From,
    reason = msg.Tags.Reason or "Unspecified misconduct",
    votes = {},
    voteCount = 0,
    totalVoteWeight = "0",
    createdAt = msg.Timestamp,
    status = PROPOSAL_STATUS.OPEN
  }
  
  msg.reply({
    Action = "Slash-Proposal-Created",
    Data = json.encode({
      proposalId = proposalId,
      targetAddress = msg.Tags.Target,
      reason = SlashProposals[proposalId].reason
    })
  })
end)

-- Handle to Vote on a Slash Proposal
Handlers.add('voteOnSlashProposal', Handlers.utils.hasMatchingTag("Action", "Vote-Slash-Proposal"), function(msg)
  assert(msg.Tags.ProposalId, "Proposal ID is required")
  assert(msg.Tags.Vote, "Vote (Yes/No) is required")
    assert(msg.Tags.Vote == "Yes" or msg.Tags.Vote == "No", "Vote must be exactly 'Yes' or 'No'")
  assert(Stakes[msg.From], "Only stakers can vote")
  
  local proposal = SlashProposals[msg.Tags.ProposalId]
  assert(proposal, "Proposal does not exist")
  assert(proposal.status == PROPOSAL_STATUS.OPEN, "Voting is closed")
  assert(not proposal.votes[msg.From], "Already voted")
  
  local voterStake = Stakes[msg.From].amount
  
  -- Record the vote
  proposal.votes[msg.From] = {
    vote = msg.Tags.Vote,
    weight = voterStake
  }
  proposal.voteCount = proposal.voteCount + 1
  proposal.totalVoteWeight = utils.add(proposal.totalVoteWeight, voterStake)
  
  msg.reply({
    Action = "Slash-Vote-Recorded",
    Data = json.encode({
      proposalId = msg.Tags.ProposalId,
      vote = msg.Tags.Vote,
      voteWeight = voterStake
    })
  })
end)


-- handler to Finalize Slash Proposal
Handlers.add('finalizeSlashProposal', Handlers.utils.hasMatchingTag("Action", "Finalize-Slash-Proposal"), function(msg)
  assert(msg.Tags.ProposalId, "Proposal ID is required")
  
  local proposal = SlashProposals[msg.Tags.ProposalId]
  assert(proposal, "Proposal does not exist")
  assert(proposal.status == PROPOSAL_STATUS.OPEN, "Proposal already finalized")
  assert(msg.Timestamp >= utils.add(proposal.createdAt, tostring(SlashConfig.VOTING_PERIOD)), "Voting period not yet complete")
  
  -- Calculate total staked tokens
  local totalStakedTokens = "0"
  for _, stake in pairs(Stakes) do
    totalStakedTokens = utils.add(totalStakedTokens, stake.amount)
  end
  
  -- Check quorum and voting requirements
  local yesVotes = "0"
  local noVotes = "0"
  for voter, voteInfo in pairs(proposal.votes) do
    if voteInfo.vote == "Yes" then
      yesVotes = utils.add(yesVotes, voteInfo.weight)
    else
      noVotes = utils.add(noVotes, voteInfo.weight)
    end
  end
  
  local yesPercentage
  if totalStakedTokens == "0" then
    yesPercentage = "0"
  else
    yesPercentage = utils.percentage(yesVotes, totalStakedTokens)
  end
  local proposalPassed = (
    proposal.voteCount >= SlashConfig.MINIMUM_SLASH_VOTES and
    bint(yesPercentage) >= bint(SlashConfig.QUORUM_PERCENTAGE)
  )
  
  if proposalPassed then
    -- Execute slashing
    local targetStake = Stakes[proposal.targetAddress]
    local slashAmount = utils.multiply(targetStake.amount, tostring(SlashConfig.SLASH_PERCENTAGE / 100))
    
    -- Reduce stake
    targetStake.amount = utils.subtract(targetStake.amount, slashAmount)
    proposal.status = PROPOSAL_STATUS.EXECUTED
    
    Send({
      Target = proposal.targetAddress,
      Action = "Stake-Slashed",
      Data = json.encode({
        amount = slashAmount,
        reason = proposal.reason
      })
    })
  else
    proposal.status = PROPOSAL_STATUS.FAILED
  end
  
  msg.reply({
    Action = "Slash-Proposal-Finalized",
    Data = json.encode({
      proposalId = msg.Tags.ProposalId,
      passed = proposalPassed,
      yesVotes = yesVotes,
      noVotes = noVotes,
      status = proposal.status
    })
  })
end)

-- Handler to View Specific Proposal by ID
Handlers.add('viewProposalById', Handlers.utils.hasMatchingTag("Action", "View-Proposal-By-Id"), function(msg)
  assert(msg.Tags.ProposalId, "Proposal ID is required")
  
  local proposal = SlashProposals[msg.Tags.ProposalId]
  assert(proposal, "Proposal not found")
  
  -- Detailed proposal breakdown
  local detailedProposal = {
    proposalId = msg.Tags.ProposalId,
    targetAddress = proposal.targetAddress,
    proposer = proposal.proposer,
    reason = proposal.reason,
    status = proposal.status,
    createdAt = proposal.createdAt,
    votingDeadline = proposal.createdAt + SlashConfig.VOTING_PERIOD,
    totalVoteWeight = proposal.totalVoteWeight,
    votes = {
      total = proposal.voteCount,
      details = {}
    }
  }
  
  -- Collect vote details
  for voter, voteInfo in pairs(proposal.votes) do
    table.insert(detailedProposal.votes.details, {
      voter = voter,
      vote = voteInfo.vote,
      weight = voteInfo.weight
    })
  end
  
  -- Calculate vote percentages
  for _, voteDetail in ipairs(detailedProposal.votes.details) do
    voteDetail.votePercentage = utils.percentage(voteDetail.weight, proposal.totalVoteWeight)
  end
  
  msg.reply({
    Action = "Proposal-Details",
    Data = json.encode(detailedProposal)
  })
end)

-- Handler to View All Proposals
Handlers.add('viewAllProposals', Handlers.utils.hasMatchingTag("Action", "View-All-Proposals"), function(msg)
  -- Prepare a list of all proposals with key information
  local allProposals = {}
  
  for proposalId, proposal in pairs(SlashProposals) do
    local summaryProposal = {
      proposalId = proposalId,
      targetAddress = proposal.targetAddress,
      proposer = proposal.proposer,
      reason = proposal.reason,
      status = proposal.status,
      createdAt = proposal.createdAt,
      votingDeadline = proposal.createdAt + SlashConfig.VOTING_PERIOD,
      voteCount = proposal.voteCount,
      totalVoteWeight = proposal.totalVoteWeight
    }
    
    -- Calculate vote breakdown
    local yesVotes = "0"
    local noVotes = "0"
    for _, voteInfo in pairs(proposal.votes) do
      if voteInfo.vote == "Yes" then
        yesVotes = utils.add(yesVotes, voteInfo.weight)
      else
        noVotes = utils.add(noVotes, voteInfo.weight)
      end
    end
    
    summaryProposal.votes = {
      yes = yesVotes,
      no = noVotes
    }
    
    table.insert(allProposals, summaryProposal)
  end
  
  -- Sort proposals by creation time (most recent first)
  table.sort(allProposals, function(a, b) 
    return a.createdAt > b.createdAt 
  end)
  
  msg.reply({
    Action = "All-Proposals",
    Data = json.encode({
      totalProposals = #allProposals,
      proposals = allProposals
    })
  })
end)

-- Handler to view stake information
Handlers.add('viewStake', Handlers.utils.hasMatchingTag("Action", "View-Stake"), function(msg)
  local target = msg.Tags.Target or msg.From
  initStake(target)
  
  local stakeInfo = Stakes[target]
  local timeRemaining = 0
  
  if stakeInfo.status == STATUS.IN_COOLDOWN then
    timeRemaining = math.max(0, (stakeInfo.cooldownStart + CooldownPeriod) - msg.Timestamp)
  end
  
  local response = {
    address = target,
    stake = stakeInfo,
    timeRemaining = timeRemaining,
    canWithdraw = timeRemaining == 0 and stakeInfo.status == STATUS.IN_COOLDOWN
  }
  
    msg.reply({
      Action = "Stake-Info",
      Data = json.encode(response)
    })
end)

-- Handler to view all stakes (admin only)
Handlers.add('viewAllStakes', Handlers.utils.hasMatchingTag("Action", "View-All-Stakes"), function(msg)
  
    msg.reply({
      Action = "All-Stakes",
      Data = json.encode(Stakes)
    })
end)