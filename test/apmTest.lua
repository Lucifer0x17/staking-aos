-- TESTS
local Test = require("@rakis/test-unit")

-- 1. Stake Functionality Tests

StakeTests = Test.new("Staking Process Tests")

-- Test Valid Stake
StakeTests:add("Valid Stake Submission", function()
    local validStakeMsg = {
        Target = ao.id,
        Action = "Credit-Notice",
        ["X-Action"] = "Stake",
        Sender = "TestUser1",
        Quantity = tostring(15 * 10^12),  -- Above minimum stake
        Timestamp = os.time()
    }
    
    local status, result = pcall(function ()
      Send(validStakeMsg)
    end)
    
    print(status,result)
    assert(status, "Valid stake should be processed without error")
    assert(Stakes["TestUser1"], "Stake should be recorded")
    assert(utils.isGreaterThanOrEqual(Stakes["TestUser1"].amount, tostring(10 * 10^12)), "Stake amount should be recorded correctly")
end)

-- Test Stake Below Minimum
StakeTests:add("Stake Below Minimum", function()
    local invalidStakeMsg = {
        Target = ao.id,
        From = TokenProcess,
        Action = "Credit-Notice", 
        ["X-Action"] = "Stake",
        Sender = "TestUser2",
        Tags = {
            Quantity = tostring(5 * 10^12)  -- Below minimum stake
        },
        Timestamp = os.time()
    }
    
    local status, errorMsg = pcall(Send(invalidStakeMsg))
    
    assert(not status, "Stake below minimum should throw an error")
end)

-- 2. Unstake Functionality Tests

-- Test Successful Unstake Initiation
StakeTests:add("Successful Unstake Initiation", function()
    -- First, create a valid stake
    local stakeMsg = {
        From = TokenProcess,
        Action = "Credit-Notice",
        ["X-Action"] = "Stake",
        Sender = "UnstakeTestUser",
        Tags = {
            Quantity = tostring(20 * 10^12)
        },
        Timestamp = os.time()
    }
    handle(stakeMsg)
    
    -- Then attempt to unstake
    local unstakeMsg = {
        From = "UnstakeTestUser",
        Action = "Unstake"
    }
    
    local status, result = pcall(function() 
        handle(unstakeMsg) 
    end)
    
    assert(status, "Unstake should be processed without error")
    assert(Stakes["UnstakeTestUser"].status == STATUS.IN_COOLDOWN, "Stake status should be IN_COOLDOWN")
end)

-- Test Double Unstake
StakeTests:add("Double Unstake Attempt", function()
    local unstakeMsg = {
        From = "UnstakeTestUser",
        Action = "Unstake"
    }
    
    local status, errorMsg = pcall(function() 
        handle(unstakeMsg) 
    end)
    
    assert(not status, "Second unstake should throw an error")
end)

-- 3. Withdraw Functionality Tests

-- Test Successful Withdraw
StakeTests:add("Successful Withdraw After Cooldown", function()
    -- Simulate passing cooldown period
    local withdrawMsg = {
        From = "UnstakeTestUser",
        Action = "Withdraw",
        Timestamp = os.time() + (31 * 24 * 60 * 60)  -- 31 days later
    }
    
    local status, result = pcall(function() 
        handle(withdrawMsg) 
    end)
    
    assert(status, "Withdraw should be processed without error")
    assert(Stakes["UnstakeTestUser"].amount == "0", "Stake should be reset after withdrawal")
end)

-- Test Premature Withdraw
StakeTests:add("Premature Withdraw Attempt", function()
    local prematureWithdrawMsg = {
        From = "UnstakeTestUser",
        Action = "Withdraw",
        Timestamp = os.time() + (20 * 24 * 60 * 60)  -- Before cooldown ends
    }
    
    local status, errorMsg = pcall(function() 
        handle(prematureWithdrawMsg) 
    end)
    
    assert(not status, "Withdraw before cooldown should throw an error")
end)

-- 4. Slash Proposal System Tests

-- Test Create Slash Proposal
StakeTests:add("Create Slash Proposal", function()
    local createSlashMsg = {
        From = "ProposalCreator",
        Action = "Create-Slash-Proposal",
        Tags = {
            Target = "UnstakeTestUser",
            Reason = "Test Misconduct"
        },
        Id = "TestProposalID",
        Timestamp = os.time()
    }
    
    local status, result = pcall(function() 
        handle(createSlashMsg) 
    end)
    
    assert(status, "Slash proposal creation should work")
    assert(SlashProposals["TestProposalID"], "Proposal should be recorded")
end)

-- Test Vote on Slash Proposal
StakeTests:add("Vote on Slash Proposal", function()
    local voteMsg = {
        From = "VotingStaker",
        Action = "Vote-Slash-Proposal",
        Tags = {
            ProposalId = "TestProposalID",
            Vote = "Yes"
        }
    }
    
    local status, result = pcall(function() 
        handle(voteMsg) 
    end)
    
    assert(status, "Voting on proposal should work")
    assert(SlashProposals["TestProposalID"].votes["VotingStaker"], "Vote should be recorded")
end)

-- 5. Stake Information Retrieval Tests

-- Test View Stake
StakeTests:add("View Individual Stake", function()
    local viewStakeMsg = {
        From = "UnstakeTestUser",
        Action = "View-Stake"
    }
    
    local status, result = pcall(function() 
        handle(viewStakeMsg) 
    end)
    
    assert(status, "Viewing stake should work")
end)

-- Test View All Stakes
StakeTests:add("View All Stakes", function()
    local viewAllStakesMsg = {
        From = "AdminUser",
        Action = "View-All-Stakes"
    }
    
    local status, result = pcall(function() 
        handle(viewAllStakesMsg) 
    end)
    
    assert(status, "Viewing all stakes should work")
end)

-- Error Handling and Edge Cases

-- Test Invalid Message Handling
StakeTests:add("Invalid Message Handling", function()
    local invalidMsg = {
        From = "RandomUser",
        Action = "InvalidAction"
    }
    
    local status, result = pcall(function() 
        handle(invalidMsg) 
    end)
    
    assert(not status, "Invalid messages should be rejected")
end)

local testResults = StakeTests:run()
print(testResults)